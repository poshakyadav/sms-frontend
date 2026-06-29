// src/app/features/school/billing/services/bundle-payment.service.ts
//
// Handles WhatsApp (and future Email/SMS) bundle purchase via Razorpay Orders.
// Identical Checkout choreography to AccessPaymentService — only the
// initiate/verify endpoints and the post-verify action differ.

import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';

import { BillingService } from './billing.service';
import { loadRazorpayScript } from '../utils/razorpay-loader';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { RazorpayPaymentResponse } from '../types/razorpay.types';
import { WhatsappService } from '../../features/school/whatsapp/services/whatsapp.service';

export interface BundleOrderResult {
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  platformPaymentId: number;
}

@Injectable({ providedIn: 'root' })
export class BundlePaymentService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private billing = inject(BillingService);
  private whatsapp = inject(WhatsappService);

  isProcessing = signal(false);
  processingStep = signal<'idle' | 'initiating' | 'checkout' | 'verifying' | 'success' | 'error'>(
    'idle'
  );

  async purchaseBundle(bundleId: number, bundleName: string): Promise<void> {
    this.isProcessing.set(true);
    this.processingStep.set('initiating');

    try {
      await loadRazorpayScript();

      const initiateRes = await this.api
        .post<{ success: boolean } & BundleOrderResult>('school/payments/bundles/initiate', {
          bundleId,
        })
        .toPromise();

      if (!initiateRes?.success) {
        throw new Error('Failed to create bundle order. Please try again.');
      }

      await this.openBundleCheckout(initiateRes, bundleName);
    } catch (err: any) {
      this.processingStep.set('error');
      this.isProcessing.set(false);
      throw err;
    }
  }

  private openBundleCheckout(order: BundleOrderResult, bundleName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.processingStep.set('checkout');

      const branding = this.auth.getStoredSchoolBranding();
      const user = this.auth.schoolUser();

      const options: any = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || 'INR',
        name: branding?.name || 'School Management System',
        description: bundleName,
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
            this.toast.error('Purchase cancelled.');
            reject(new Error('Bundle purchase dismissed'));
          },
          animation: true,
        },
        handler: async (response: RazorpayPaymentResponse) => {
          try {
            await this.verifyBundlePayment(response);
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

  private async verifyBundlePayment(response: RazorpayPaymentResponse): Promise<void> {
    this.processingStep.set('verifying');

    const verifyRes = await this.api
      .post<{ success: boolean; creditsAdded: number; channel: string }>(
        'school/payments/bundles/verify',
        {
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }
      )
      .toPromise();

    if (!verifyRes?.success) {
      throw new Error(
        'Payment verified but credit activation failed. Contact support — your payment is safe.'
      );
    }

    this.processingStep.set('success');
    this.isProcessing.set(false);

    // Refresh WhatsApp balance in BOTH stores — billing-overview reads
    // BillingService, the WhatsApp module reads WhatsappService.
    this.billing.loadWhatsappBalance().subscribe();
    this.whatsapp.loadBalance().subscribe();

    this.toast.success(
      `✅ ${verifyRes.creditsAdded.toLocaleString('en-IN')} WhatsApp credits added to your account!`
    );
  }
}
