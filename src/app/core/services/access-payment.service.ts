// src/app/core/services/access-payment.service.ts
//
// Owns the Razorpay Checkout.js lifecycle for one-time and Autopay
// access-plan payments. Loads checkout.js once, opens the modal, and
// reconciles the result with the backend verify endpoints.
//
// NOTE: `Window.Razorpay` is declared ONCE, globally, in
// `core/types/razorpay.types.ts`. Do not redeclare it here or in any other
// file — TypeScript requires every `declare global` augmentation of the
// same interface in a program to have an IDENTICAL type, and a second,
// looser declaration (e.g. `Razorpay: any`) breaks the build (TS2717)
// wherever both files end up compiled together.

import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, Observable, catchError, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { BillingService } from './billing.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { RazorpayOptions, RazorpayPaymentResponse } from '../types/razorpay.types';

export type ProcessingStep = 'initiating' | 'checkout' | 'verifying' | null;

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

@Injectable({ providedIn: 'root' })
export class AccessPaymentService {
  private api = inject(ApiService);
  private billing = inject(BillingService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  isProcessing = signal(false);
  processingStep = signal<ProcessingStep>(null);

  private scriptLoadPromise: Promise<void> | null = null;

  // ── Load checkout.js exactly once; concurrent callers share the promise ──
  private loadCheckoutScript(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Payments are only available in the browser.'));
    }
    if (window.Razorpay) return Promise.resolve();
    if (this.scriptLoadPromise) return this.scriptLoadPromise;

    this.scriptLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load Razorpay Checkout.'))
        );
        return;
      }
      const script = document.createElement('script');
      script.src = RAZORPAY_CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.scriptLoadPromise = null; // allow retry next time
        reject(new Error('Failed to load Razorpay Checkout. Check your connection and try again.'));
      };
      document.body.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  private prefill() {
    const branding = this.auth.getStoredSchoolBranding();
    const schoolUser = this.auth.schoolUser();
    return {
      name: branding?.name || 'Eduxo',
      logoUrl: branding?.logoUrl || undefined,
      userName: schoolUser?.name || '',
      userEmail: schoolUser?.email || '',
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MANUAL (ONE-TIME) PAYMENT
  // ═══════════════════════════════════════════════════════════
  async initiateManualPayment(planType: 'MONTHLY' | 'YEARLY'): Promise<void> {
    this.isProcessing.set(true);
    this.processingStep.set('initiating');

    try {
      let order: any;
      try {
        order = await firstValueFrom(
          this.api.post<any>('school/payments/access/initiate', { planType })
        );
      } catch (err: any) {
        throw new Error(err?.error?.error || 'Could not start the payment. Please try again.');
      }

      await this.loadCheckoutScript();
      this.processingStep.set('checkout');

      const info = this.prefill();

      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: order.keyId,
          order_id: order.razorpayOrderId,
          amount: order.amountPaise,
          currency: order.currency,
          name: info.name,
          description: `${planType === 'MONTHLY' ? 'Monthly' : 'Yearly'} school portal access`,
          image: info.logoUrl,
          prefill: { name: info.userName, email: info.userEmail },
          notes: { planType },
          theme: { color: '#4f46e5' },
          handler: (response: RazorpayPaymentResponse) => {
            this.processingStep.set('verifying');
            this.api
              .post<any>('school/payments/access/verify', {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
              .subscribe({
                next: (res) => {
                  if (res?.success) {
                    this.toast.success(
                      `Payment successful. Access extended to ${new Date(res.expiresAt).toLocaleDateString()}.`
                    );
                    this.billing.loadAccessStatus().subscribe();
                    resolve();
                  } else {
                    reject(new Error(res?.error || 'Payment verification failed.'));
                  }
                },
                error: (err) =>
                  reject(
                    new Error(
                      err?.error?.error ||
                      'Payment verification failed. Contact support if the amount was deducted.'
                    )
                  ),
              });
          },
          modal: { ondismiss: () => reject(new Error('Payment dismissed by user.')) },
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', (resp: any) => {
          // Modal usually stays open for retry — surface the error but let
          // the user try again rather than killing the whole flow.
          this.toast.error(resp?.error?.description || 'Payment attempt failed. You can try again.');
        });

        rzp.open();
      });
    } finally {
      this.isProcessing.set(false);
      this.processingStep.set(null);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // AUTOPAY (UPI AUTOPAY) SUBSCRIPTION
  // Checkout uses `subscription_id`, not `order_id`/`amount` — Razorpay
  // pulls the charge amount from the subscription's Plan.
  // ═══════════════════════════════════════════════════════════
  async initiateAutopayPayment(planType: 'MONTHLY' | 'YEARLY'): Promise<void> {
    this.isProcessing.set(true);
    this.processingStep.set('initiating');

    try {
      let sub: any;
      try {
        sub = await firstValueFrom(
          this.api.post<any>('school/payments/access/autopay/initiate', { planType })
        );
      } catch (err: any) {
        throw new Error(err?.error?.error || 'Could not create the auto-renewal subscription.');
      }

      await this.loadCheckoutScript();
      this.processingStep.set('checkout');

      const info = this.prefill();

      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: sub.keyId,
          subscription_id: sub.razorpaySubscriptionId,
          name: info.name,
          description: `${planType === 'MONTHLY' ? 'Monthly' : 'Yearly'} auto-renewal — UPI Autopay`,
          image: info.logoUrl,
          prefill: { name: info.userName, email: info.userEmail },
          notes: { planType },
          theme: { color: '#4f46e5' },
          handler: (response: RazorpayPaymentResponse) => {
            this.processingStep.set('verifying');
            this.api
              .post<any>('school/payments/access/autopay/verify', {
                razorpaySubscriptionId: response.razorpay_subscription_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
              .subscribe({
                next: (res) => {
                  if (res?.success) {
                    this.toast.success(res.message || 'Auto-renewal enabled successfully.');
                    this.billing.loadAccessStatus().subscribe();
                    resolve();
                  } else {
                    reject(new Error(res?.error || 'Auto-renewal setup could not be confirmed.'));
                  }
                },
                error: (err) =>
                  reject(
                    new Error(err?.error?.error || 'Auto-renewal verification failed. Contact support.')
                  ),
              });
          },
          modal: { ondismiss: () => reject(new Error('Payment dismissed by user.')) },
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', (resp: any) => {
          this.toast.error(resp?.error?.description || 'Mandate authorisation failed. You can try again.');
        });

        rzp.open();
      });
    } finally {
      this.isProcessing.set(false);
      this.processingStep.set(null);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CANCEL AUTOPAY
  // Returns an Observable (not async/await) — billing-overview.ts calls
  // `.subscribe()` on this directly.
  // ═══════════════════════════════════════════════════════════
  cancelAutopay(cancelAtCycleEnd: boolean = true): Observable<any> {
    return this.api
      .post<any>('school/payments/access/autopay/cancel', { cancelAtCycleEnd })
      .pipe(
        tap((res) => {
          if (res?.success) {
            this.toast.success(res.message || 'Auto-renewal cancelled.');
            this.billing.loadAccessStatus().subscribe();
          } else {
            this.toast.error(res?.error || 'Failed to cancel auto-renewal.');
          }
        }),
        catchError((err) => {
          this.toast.error(err?.error?.error || 'Failed to cancel auto-renewal. Please try again.');
          return throwError(() => err);
        })
      );
  }
}