// src/app/features/school/billing/services/access-payment.service.ts
//
// Manages the complete access plan payment lifecycle:
//   1. Initiate Razorpay Order (manual) or Subscription (autopay)
//   2. Open Razorpay Checkout
//   3. Verify payment signature with backend
//   4. Refresh billing state on success
//
// Both payment rails (manual + autopay) are handled here.
// The caller picks the rail via `paymentMode` parameter.

import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, switchMap, tap, catchError, throwError } from 'rxjs';

import { BillingService } from './billing.service';
import { loadRazorpayScript } from '../utils/razorpay-loader';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { RazorpayPaymentResponse } from '../types/razorpay.types';

export type PaymentMode = 'manual' | 'autopay';

export interface InitiateOrderResult {
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  platformPaymentId: number;
}

export interface InitiateAutopayResult {
  razorpaySubscriptionId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class AccessPaymentService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private billing = inject(BillingService);

  // ── Payment state ─────────────────────────────────────────────────────────
  isProcessing = signal(false);
  processingStep = signal<'idle' | 'initiating' | 'checkout' | 'verifying' | 'success' | 'error'>('idle');

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL ORDER RAIL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Full manual payment flow: initiate → checkout → verify → refresh.
   * Returns a promise that resolves when the full flow completes.
   */
  async initiateManualPayment(planType: 'MONTHLY' | 'YEARLY'): Promise<void> {
    this.isProcessing.set(true);
    this.processingStep.set('initiating');

    try {
      // 1. Load Razorpay script (no-op if already loaded)
      await loadRazorpayScript();

      // 2. Create Razorpay Order via backend
      const initiateRes = await this.api
        .post<{ success: boolean } & InitiateOrderResult>('school/payments/access/initiate', {
          planType,
        })
        .toPromise();

      if (!initiateRes?.success) {
        throw new Error('Failed to create payment order. Please try again.');
      }

      // 3. Open Checkout (returns via Promise wrapping the callback)
      await this.openOrderCheckout(initiateRes, planType);
    } catch (err: any) {
      this.processingStep.set('error');
      this.isProcessing.set(false);
      throw err;
    }
  }

  private openOrderCheckout(order: InitiateOrderResult, planType: 'MONTHLY' | 'YEARLY'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.processingStep.set('checkout');

      const branding = this.auth.getStoredSchoolBranding();
      const user = this.auth.schoolUser();
      const planLabel = planType === 'MONTHLY' ? 'Monthly Access (30 days)' : 'Yearly Access (365 days)';

      const options: any = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || 'INR',
        name: branding?.name || 'School Management System',
        description: planLabel,
        image: branding?.logoUrl || undefined,
        order_id: order.razorpayOrderId,
        prefill: {
          name: user?.name || branding?.name || '',
          email: user?.email || branding?.email || '',
          contact: branding?.phone ? `+91${branding.phone.replace(/\D/g, '').slice(-10)}` : '',
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => {
            this.processingStep.set('idle');
            this.isProcessing.set(false);
            this.toast.error('Payment cancelled. Your order has been saved — you can pay later from Billing.');
            reject(new Error('Payment dismissed'));
          },
          animation: true,
        },
        handler: async (response: RazorpayPaymentResponse) => {
          try {
            await this.verifyOrderPayment(response);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  }

  private async verifyOrderPayment(response: RazorpayPaymentResponse): Promise<void> {
    this.processingStep.set('verifying');

    const verifyRes = await this.api
      .post<{ success: boolean; expiresAt: string; daysRemaining: number }>(
        'school/payments/access/verify',
        {
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }
      )
      .toPromise();

    if (!verifyRes?.success) {
      throw new Error('Payment verification failed. Contact support with your payment ID.');
    }

    this.processingStep.set('success');
    this.isProcessing.set(false);

    // Refresh access status in billing service
    this.billing.loadAccessStatus().subscribe();
    this.toast.success(`✅ Access activated! Valid until ${this.formatDate(verifyRes.expiresAt)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTOPAY RAIL (UPI Mandate / Razorpay Subscriptions)
  // ─────────────────────────────────────────────────────────────────────────

  async initiateAutopayPayment(planType: 'MONTHLY' | 'YEARLY'): Promise<void> {
    this.isProcessing.set(true);
    this.processingStep.set('initiating');

    try {
      await loadRazorpayScript();

      const initiateRes = await this.api
        .post<{ success: boolean } & InitiateAutopayResult>(
          'school/payments/access/autopay/initiate',
          { planType }
        )
        .toPromise();

      if (!initiateRes?.success) {
        throw new Error('Failed to set up auto-renewal. Please try again.');
      }

      await this.openSubscriptionCheckout(initiateRes, planType);
    } catch (err: any) {
      this.processingStep.set('error');
      this.isProcessing.set(false);
      throw err;
    }
  }

  private openSubscriptionCheckout(
    sub: InitiateAutopayResult,
    planType: 'MONTHLY' | 'YEARLY'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.processingStep.set('checkout');

      const branding = this.auth.getStoredSchoolBranding();
      const user = this.auth.schoolUser();
      const planLabel =
        planType === 'MONTHLY' ? 'Monthly Auto-Renewal (₹599/month)' : 'Yearly Auto-Renewal (₹8,985/year)';

      const options: any = {
        key: sub.keyId,
        subscription_id: sub.razorpaySubscriptionId,
        name: branding?.name || 'School Management System',
        description: planLabel,
        image: branding?.logoUrl || undefined,
        prefill: {
          name: user?.name || branding?.name || '',
          email: user?.email || branding?.email || '',
          contact: branding?.phone ? `+91${branding.phone.replace(/\D/g, '').slice(-10)}` : '',
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => {
            this.processingStep.set('idle');
            this.isProcessing.set(false);
            this.toast.error('Auto-renewal setup cancelled.');
            reject(new Error('Autopay dismissed'));
          },
          animation: true,
        },
        handler: async (response: RazorpayPaymentResponse) => {
          try {
            await this.verifyAutopayAuth(response);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  }

  private async verifyAutopayAuth(response: RazorpayPaymentResponse): Promise<void> {
    this.processingStep.set('verifying');

    const verifyRes = await this.api
      .post<{ success: boolean; message: string }>('school/payments/access/autopay/verify', {
        razorpaySubscriptionId: response.razorpay_subscription_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      })
      .toPromise();

    if (!verifyRes?.success) {
      throw new Error('Auto-renewal verification failed. Contact support.');
    }

    this.processingStep.set('success');
    this.isProcessing.set(false);

    this.billing.loadAccessStatus().subscribe();
    this.toast.success('✅ Auto-renewal enabled! Your access will renew automatically each cycle.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CANCEL AUTOPAY
  // ─────────────────────────────────────────────────────────────────────────

  cancelAutopay(cancelAtCycleEnd = true): Observable<any> {
    return this.api
      .post<{ success: boolean; message: string }>('school/payments/access/autopay/cancel', {
        cancelAtCycleEnd,
      })
      .pipe(
        tap((res) => {
          if (res.success) {
            this.billing.loadAccessStatus().subscribe();
            this.toast.success(res.message);
          }
        })
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  }
}