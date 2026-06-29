// src/app/features/school/school-onboard/school-onboard.ts
//
// /school/onboard?token=<uuid>
// The main onboarding wizard: validates invite token, handles all 4 steps,
// manages the full state machine described in the onboarding spec.

import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardState =
  | 'loading'
  | 'error'
  | 'step1'
  | 'step2'
  | 'step3'
  | 'step4'
  | 'already_submitted';

interface InvitationData {
  token: string;
  schoolName: string;
  schoolEmail: string;
  schoolPhone?: string;
  city?: string;
  status: string;
  schoolId?: number;
  expiresAt: string;
}

interface PaymentConfig {
  setupFeeAmount: number;
  setupFeeDiscountPaise: number;
  setupFeeFinalAmountPaise: number;
  isFeeEnabled: boolean;
  upiId?: string;
  qrCodeUrl?: string;
  feeDescription?: string;
  razorpayKeyId: string;
}

interface ValidateInviteResponse {
  valid: boolean;
  error?: string;
  alreadyRegistered?: boolean;
  schoolCode?: string;
  registeredDetails?: Record<string, string> | null;
  invitation?: InvitationData;
  paymentConfig?: PaymentConfig;
}

interface PaymentStatusResponse {
  success: boolean;
  school: {
    name: string;
    onboardingStatus: string;
    isActive: boolean;
  };
  razorpayPayments: Array<{
    status: string;
    capturedAt?: string;
  }>;
}

// Declare Razorpay global (loaded dynamically)
declare const Razorpay: any;

@Component({
  selector: 'app-school-onboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatStepperModule,
    MatTooltipModule,
  ],
  templateUrl: './school-onboard.html',
  styleUrl: './school-onboard.scss',
})
export class SchoolOnboard implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  // ── Core state ──────────────────────────────────────────────────────────────
  wizardState = signal<WizardState>('loading');
  errorMessage = signal('');
  token = signal<string | null>(null);
  schoolCode = signal<string | null>(null);
  invitation = signal<InvitationData | null>(null);
  paymentConfig = signal<PaymentConfig | null>(null);

  // Step 1 form
  step1 = {
    schoolName: '',
    addressLineOne: '',
    addressLineTwo: '',
    phone: '',
    alternatePhone: '',
    schoolEmail: '',
    website: '',
  };

  // Step 2 form
  step2 = {
    ownerName: '',
    ownerEmail: '',
    password: '',
    confirmPassword: '',
    ownerPhone: '',
    ownerAlternatePhone: '',
    termsAccepted: false,
  };

  // UI flags
  loading = signal(false);
  paymentLoading = signal(false);
  pollingLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  // Step 2 errors
  passwordMismatch = signal(false);
  signupError = signal('');

  // Step 3 errors
  paymentError = signal('');

  // Step 4 status
  isActivated = signal(false);
  pollingInterval: any = null;
  schoolName = signal('');

  // Derived: formatted fee
  formattedFee = computed(() => {
    const config = this.paymentConfig();
    if (!config || !config.isFeeEnabled) return '₹0';
    const paise = config.setupFeeFinalAmountPaise;
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadRazorpayScript();

    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.wizardState.set('error');
      this.errorMessage.set('Invalid link. Please contact support.');
      return;
    }

    this.token.set(token);
    this.validateToken(token);
  }

  ngOnDestroy(): void {
    this.clearPolling();
  }

  // ── Token validation ────────────────────────────────────────────────────────

  private validateToken(token: string): void {
    this.wizardState.set('loading');

    this.http
      .get<ValidateInviteResponse>(`${environment.apiUrl}/school/auth/validate-invite/${token}`)
      .subscribe({
        next: (res) => {
          if (!res.valid) {
            this.wizardState.set('error');
            this.errorMessage.set(res.error || 'Invalid or expired invitation link.');
            return;
          }

          this.invitation.set(res.invitation ?? null);
          this.paymentConfig.set(res.paymentConfig ?? null);

          if (res.alreadyRegistered) {
            this.schoolCode.set(res.schoolCode ?? null);
            this.schoolName.set(res.invitation?.schoolName ?? '');

            const invStatus = res.invitation?.status ?? '';

            if (invStatus === 'PAYMENT_SUBMITTED') {
              // Skip everything — show polling screen
              this.wizardState.set('already_submitted');
              this.startPolling();
              return;
            }

            if (invStatus === 'REGISTERED') {
              // Skip steps 1 & 2 — go to payment
              this.prefillFromRegisteredDetails(res.registeredDetails ?? null);
              this.wizardState.set('step3');
              return;
            }
          }

          // Fresh token — start from step 1
          this.prefillStep1FromInvitation(res.invitation ?? null);
          this.wizardState.set('step1');
        },
        error: (err) => {
          this.wizardState.set('error');
          this.errorMessage.set(
            err?.error?.error || 'Failed to validate invitation. Please try again.'
          );
        },
      });
  }

  private prefillStep1FromInvitation(inv: InvitationData | null): void {
    if (!inv) return;
    this.step1.schoolName = inv.schoolName ?? '';
    this.step1.schoolEmail = inv.schoolEmail ?? '';
    this.step1.phone = inv.schoolPhone ?? '';
  }

  private prefillFromRegisteredDetails(details: Record<string, string> | null): void {
    if (!details) return;
    this.step1.schoolName = details['schoolName'] ?? '';
    this.step1.addressLineOne = details['addressLineOne'] ?? '';
    this.step1.addressLineTwo = details['addressLineTwo'] ?? '';
    this.step1.phone = details['phone'] ?? '';
    this.step1.alternatePhone = details['alternatePhone'] ?? '';
    this.step1.schoolEmail = details['schoolEmail'] ?? '';
    this.step1.website = details['schoolWebsite'] ?? '';
    this.step2.ownerName = details['ownerName'] ?? '';
    this.step2.ownerEmail = details['ownerEmail'] ?? '';
    this.step2.ownerPhone = details['ownerPhone'] ?? '';
    this.schoolName.set(details['schoolName'] ?? '');
  }

  // ── Step navigation ─────────────────────────────────────────────────────────

  isStep1Valid(): boolean {
    return !!(
      this.step1.schoolName.trim() &&
      this.step1.addressLineOne.trim() &&
      this.step1.phone.trim() &&
      this.step1.schoolEmail.trim()
    );
  }

  goToStep2(): void {
    if (!this.isStep1Valid()) return;
    this.wizardState.set('step2');
  }

  backToStep1(): void {
    this.wizardState.set('step1');
    this.signupError.set('');
  }

  isStep2Valid(): boolean {
    return !!(
      this.step2.ownerName.trim() &&
      this.step2.ownerEmail.trim() &&
      this.step2.password &&
      this.step2.confirmPassword &&
      this.step2.ownerPhone.trim() &&
      this.step2.termsAccepted &&
      this.step2.password === this.step2.confirmPassword
    );
  }

  onPasswordChange(): void {
    this.passwordMismatch.set(
      !!(
        this.step2.password &&
        this.step2.confirmPassword &&
        this.step2.password !== this.step2.confirmPassword
      )
    );
  }

  // ── Step 2: Account creation (POST /school/auth/signup) ─────────────────────

  createAccount(): void {
    if (!this.isStep2Valid() || this.loading()) return;

    this.loading.set(true);
    this.signupError.set('');

    const payload = {
      inviteToken: this.token()!,
      ownerName: this.step2.ownerName.trim(),
      ownerEmail: this.step2.ownerEmail.trim().toLowerCase(),
      ownerPassword: this.step2.password,
      ownerPhone: this.step2.ownerPhone.trim(),
      ownerAlternatePhone: this.step2.ownerAlternatePhone.trim(),
      schoolName: this.step1.schoolName.trim(),
      addressLineOne: this.step1.addressLineOne.trim(),
      addressLineTwo: this.step1.addressLineTwo.trim(),
      phone: this.step1.phone.trim(),
      alternatePhone: this.step1.alternatePhone.trim(),
      schoolEmail: this.step1.schoolEmail.trim().toLowerCase(),
      schoolWebsite: this.step1.website.trim(),
      termsAccepted: true as const,
    };

    // 🔍 DEBUG LOG — exact payload being sent
    console.log('📤 POST /school/auth/signup payload:', {
      ...payload,
      ownerPassword: '[REDACTED]',
    });

    this.http.post<any>(`${environment.apiUrl}/school/auth/signup`, payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        const code = res.schoolCode;
        this.schoolCode.set(code);
        this.schoolName.set(this.step1.schoolName);
        this.wizardState.set('step3');
      },
      error: (err) => {
        this.loading.set(false);
        const body = err?.error;

        // 🔍 DEBUG LOG — full error body from backend
        console.error('📥 /signup error response:', body);

        // Already registered — go to payment
        if (err.status === 409 || body?.onboardingStatus === 'REGISTERED') {
          const code = body?.schoolCode;
          if (code) this.schoolCode.set(code);
          this.schoolName.set(this.step1.schoolName);
          this.wizardState.set('step3');
          return;
        }

        this.signupError.set(
          this.extractErrorMessage(body, 'Failed to create account. Please try again.')
        );
      },
    });
  }

  // ── Step 3: Payment ─────────────────────────────────────────────────────────

  initiatePayment(): void {
    const code = this.schoolCode();
    const config = this.paymentConfig();

    if (!code || !config || this.paymentLoading()) return;

    this.paymentLoading.set(true);
    this.paymentError.set('');

    this.http
      .post<any>(`${environment.apiUrl}/payments/setup-fee/initiate`, { schoolCode: code })
      .subscribe({
        next: (res) => {
          this.paymentLoading.set(false);
          this.openRazorpay(res);
        },
        error: (err) => {
          this.paymentLoading.set(false);
          // 🔍 DEBUG LOG — surfaces the exact backend rejection reason
        console.error('📥 /payments/setup-fee/initiate error:', err?.error);
          this.paymentError.set(
            err?.error?.error || 'Failed to initiate payment. Please try again.'
          );
        },
      });
  }

  private openRazorpay(orderData: any): void {
    if (typeof Razorpay === 'undefined') {
      // 🔍 DEBUG LOG — script genuinely hasn't loaded yet
      console.error('❌ Razorpay checkout script not loaded yet.');
      this.paymentError.set(
        'Payment system is still loading. Please wait a moment and try again.'
      );
      return;
    }

    const config = this.paymentConfig();
    const keyId = orderData.keyId || config?.razorpayKeyId || '';

    if (!keyId) {
      console.error('❌ No Razorpay keyId received from backend.');
      this.paymentError.set('Payment configuration error. Please contact support.');
      return;
    }

    if (!orderData.amountPaise || orderData.amountPaise <= 0) {
      console.error('❌ Invalid amountPaise from backend:', orderData.amountPaise);
      this.paymentError.set('Invalid payment amount. Please contact support.');
      return;
    }

    const options = {
      key: keyId,
      amount: orderData.amountPaise,
      currency: orderData.currency || 'INR',
      name: 'School Management System',
      description: 'One-time School Setup Fee',
      order_id: orderData.razorpayOrderId,
      prefill: {
        name: this.step2.ownerName || '',
        email: this.step2.ownerEmail || this.step1.schoolEmail || '',
        contact: this.step2.ownerPhone || this.step1.phone || '',
      },
      theme: { color: '#4f46e5' },
      // ── Hide payment methods irrelevant for a B2B school SaaS ──────────────
      // Pay Later (BNPL) and EMI make no sense for a business paying a
      // setup fee. Hiding them keeps the modal clean and avoids confusion.
      // Wallet is also hidden — schools won't have Paytm/MobiKwik wallets
      // loaded with business funds.
      config: {
        display: {
          hide: [
            { method: 'paylater' },
            { method: 'emi' },
            { method: 'wallet' },
          ],
          preferences: {
            show_default_blocks: true, // still show Cards, Netbanking, UPI
          },
        },
      },
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
    } catch (e) {
      console.error('❌ Razorpay open() threw:', e);
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
        this.wizardState.set('step4');
        this.startPolling();
      },
      error: (err) => {
        this.paymentLoading.set(false);
        this.paymentError.set(
          err?.error?.error || 'Payment verification failed. Contact support with your payment ID.'
        );
      },
    });
  }

  // ── Step 4: Polling ─────────────────────────────────────────────────────────

  checkStatus(): void {
    const code = this.schoolCode();
    if (!code || this.pollingLoading()) return;

    this.pollingLoading.set(true);
    this.fetchStatus(code);
  }

  private startPolling(): void {
    const code = this.schoolCode();
    if (!code) return;

    // Initial check
    this.fetchStatus(code);

    // Poll every 30 seconds
    this.pollingInterval = setInterval(() => {
      this.fetchStatus(code);
    }, 30_000);
  }

  private fetchStatus(code: string): void {
    this.http
      .get<PaymentStatusResponse>(`${environment.apiUrl}/school/auth/payment-status/${code}`)
      .subscribe({
        next: (res) => {
          this.pollingLoading.set(false);
          if (res.school?.isActive) {
            this.isActivated.set(true);
            this.schoolName.set(res.school.name || this.schoolName());
            this.clearPolling();
          }
        },
        error: () => {
          this.pollingLoading.set(false);
        },
      });
  }

  private clearPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // ── Razorpay script loader ──────────────────────────────────────────────────

  private loadRazorpayScript(): void {
    if (typeof Razorpay !== 'undefined') return;
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.head.appendChild(script);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  copySchoolCode(): void {
    const code = this.schoolCode();
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => { });
  }

  goToLogin(): void {
    this.router.navigate(['/school/login']);
  }

  getStepNumber(): number {
    const map: Record<WizardState, number> = {
      loading: 0,
      error: 0,
      already_submitted: 4,
      step1: 1,
      step2: 2,
      step3: 3,
      step4: 4,
    };
    return map[this.wizardState()] ?? 0;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private extractErrorMessage(body: any, fallback: string): string {
    if (!body) return fallback;
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.issues) && body.issues.length) {
      return body.issues.map((i: any) => i.message).join('; ');
    }
    if (body.error?.issues && Array.isArray(body.error.issues)) {
      return body.error.issues.map((i: any) => i.message).join('; ');
    }
    return fallback;
  }
}
