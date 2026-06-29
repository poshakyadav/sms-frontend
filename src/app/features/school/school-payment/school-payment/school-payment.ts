// src/app/features/school/school-payment/school-payment.ts
//
// /school/payment?code=<schoolCode>
// Payment resume page — for schools that completed signup but didn't pay.
// Reached via the payment instructions email link.

import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../../environments/environment';

// Declare Razorpay global
declare const Razorpay: any;

interface RegistrationDetails {
  schoolName?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  addressLineOne?: string;
  phone?: string;
  schoolEmail?: string;
}

interface PaymentConfig {
  setupFeeFinalAmountPaise: number;
  isFeeEnabled: boolean;
  feeDescription?: string;
  razorpayKeyId?: string;
}

@Component({
  selector: 'app-school-payment',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './school-payment.html',
  styleUrl: './school-payment.scss',
})
export class SchoolPayment implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  // State
  pageState = signal<'loading' | 'ready' | 'error' | 'paid'>('loading');
  errorMessage = signal('');
  schoolCode = signal<string | null>(null);
  registrationDetails = signal<RegistrationDetails | null>(null);
  paymentConfig = signal<PaymentConfig | null>(null);
  paymentLoading = signal(false);
  paymentError = signal('');

  formattedFee = computed(() => {
    const config = this.paymentConfig();
    if (!config || !config.isFeeEnabled) return '₹0';
    return `₹${(config.setupFeeFinalAmountPaise / 100).toLocaleString('en-IN')}`;
  });

  ngOnInit(): void {
    this.loadRazorpayScript();

    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.pageState.set('error');
      this.errorMessage.set('No school code provided. Please use the link from your email.');
      return;
    }

    this.schoolCode.set(code.toUpperCase());
    this.loadRegistrationDetails(code.toUpperCase());
  }

  private loadRegistrationDetails(code: string): void {
    // Load registration details + payment config in parallel
    const detailsReq = this.http.get<any>(
      `${environment.apiUrl}/school/auth/registration-details/${code}`
    );
    const statusReq = this.http.get<any>(
      `${environment.apiUrl}/school/auth/payment-status/${code}`
    );
    const configReq = this.http.get<any>(
      `${environment.apiUrl}/school/auth/validate-invite/dummy` // fallback — handled below
    );

    // Fetch registration details
    detailsReq.subscribe({
      next: (res) => {
        if (res.success) {
          this.registrationDetails.set(res.details ?? null);
        }
      },
      error: () => {
        // Non-critical — page still works without pre-fill
      },
    });

    // Fetch payment status to get config + check if already paid
    statusReq.subscribe({
      next: (res) => {
        if (!res.success) {
          this.pageState.set('error');
          this.errorMessage.set('School not found. Please check the link in your email.');
          return;
        }

        const status = res.school?.onboardingStatus;

        // Already active — redirect to login
        if (status === 'ACTIVE' || res.school?.isActive) {
          this.router.navigate(['/school/payment-status'], {
            queryParams: { code, activated: 'true' },
          });
          return;
        }

        // Already submitted — go to status page
        if (status === 'PAYMENT_SUBMITTED') {
          this.router.navigate(['/school/payment-status'], { queryParams: { code } });
          return;
        }

        // Extract payment config from razorpay payment if available
        if (res.paymentConfig) {
          this.paymentConfig.set(res.paymentConfig);
        } else {
          // Try to get from payment initiate — leave as null, will be fetched on pay
          this.paymentConfig.set({
            setupFeeFinalAmountPaise: 0,
            isFeeEnabled: true,
            feeDescription: 'One-time school setup fee',
          });
        }

        this.pageState.set('ready');
      },
      error: (err) => {
        this.pageState.set('error');
        this.errorMessage.set(
          err?.error?.error || 'Failed to load payment details. Please try again.'
        );
      },
    });
  }

  initiatePayment(): void {
    const code = this.schoolCode();
    if (!code || this.paymentLoading()) return;

    this.paymentLoading.set(true);
    this.paymentError.set('');

    this.http
      .post<any>(`${environment.apiUrl}/payments/setup-fee/initiate`, { schoolCode: code })
      .subscribe({
        next: (res) => {
          this.paymentLoading.set(false);
          // Update fee display with actual amount from server
          this.paymentConfig.update((c) =>
            c
              ? { ...c, setupFeeFinalAmountPaise: res.amountPaise }
              : { setupFeeFinalAmountPaise: res.amountPaise, isFeeEnabled: true }
          );
          this.openRazorpay(res);
        },
        error: (err) => {
          this.paymentLoading.set(false);
          this.paymentError.set(
            err?.error?.error || 'Failed to initiate payment. Please try again.'
          );
        },
      });
  }

  private openRazorpay(orderData: any): void {
    const details = this.registrationDetails();
    const keyId = orderData.keyId || '';

    const options = {
      key: keyId,
      amount: orderData.amountPaise,
      currency: orderData.currency || 'INR',
      name: 'School Management System',
      description: 'One-time School Setup Fee',
      order_id: orderData.razorpayOrderId,
      prefill: {
        name: details?.ownerName || '',
        email: details?.ownerEmail || details?.schoolEmail || '',
        contact: details?.ownerPhone || details?.phone || '',
      },
      theme: { color: '#4f46e5' },
      handler: (response: any) => {
        this.verifyPayment(response);
      },
      modal: {
        ondismiss: () => {
          this.paymentError.set('Payment was cancelled. You can try again.');
        },
      },
    };

    try {
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        this.paymentError.set(response?.error?.description || 'Payment failed. Please try again.');
      });
      rzp.open();
    } catch {
      this.paymentError.set('Could not open payment window. Please refresh and try again.');
    }
  }

  private verifyPayment(response: any): void {
    const code = this.schoolCode();
    if (!code) return;

    this.paymentLoading.set(true);
    this.paymentError.set('');

    const payload = {
      schoolCode: code,
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    };

    this.http.post<any>(`${environment.apiUrl}/payments/setup-fee/verify`, payload).subscribe({
      next: () => {
        this.paymentLoading.set(false);
        // Redirect to status page
        this.router.navigate(['/school/payment-status'], { queryParams: { code } });
      },
      error: (err) => {
        this.paymentLoading.set(false);
        this.paymentError.set(
          err?.error?.error || 'Payment verification failed. Contact support with your payment ID.'
        );
      },
    });
  }

  private loadRazorpayScript(): void {
    if (typeof Razorpay !== 'undefined') return;
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.head.appendChild(script);
  }
}
