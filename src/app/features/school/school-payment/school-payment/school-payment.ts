// features/school/school-payment/school-payment/school-payment.ts

import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

interface PaymentStatus {
  school: {
    name: string;
    onboardingStatus: string;
    isActive: boolean;
  };
  paymentRecord: {
    status: string;
    utrNumber: string;
    submittedAt: string;
    rejectionReason?: string;
  } | null;
  paymentConfig: {
    setupFeeAmount: number;
    upiId: string;
    qrCodeUrl: string;
    feeDescription: string;
    isFeeEnabled: boolean;
  } | null;
}

interface RegisteredDetails {
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerAlternatePhone?: string;
  schoolName: string;
  addressLineOne: string;
  addressLineTwo?: string;
  phone?: string;
  alternatePhone?: string;
  schoolEmail?: string;
  schoolWebsite?: string;
  registeredAt?: string;
  termsAcceptedAt?: string;
}

@Component({
  selector: 'app-school-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe],
  templateUrl: './school-payment.html',
  styleUrl: './school-payment.scss',
  // ── FIX 1: skip SSR hydration entirely for this page ──────────────────────
  // This component is public (pre-login), so there is no SEO need for SSR.
  // Skipping hydration eliminates NG0502 which is triggered by @if blocks
  // inside the accordion whose DOM differs between server and client renders.
  host: { ngSkipHydration: 'true' },
})
export class SchoolPayment implements OnInit {
  schoolCode = '';
  inviteToken = signal<string | null>(null);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  paymentStatus = signal<PaymentStatus | null>(null);
  copiedUpi = signal(false);

  registeredDetails = signal<RegisteredDetails | null>(null);
  loadingDetails = signal(false);
  showDetailsPanel = signal(false);

  readonly onboardingStatus = computed(() => this.paymentStatus()?.school?.onboardingStatus ?? '');
  readonly paymentRecord = computed(() => this.paymentStatus()?.paymentRecord ?? null);
  readonly paymentConfig = computed(() => this.paymentStatus()?.paymentConfig ?? null);

  readonly feeFormatted = computed(() => {
    const cfg = this.paymentConfig();
    if (!cfg || !cfg.isFeeEnabled || cfg.setupFeeAmount === 0) return 'Contact support';
    return `₹${(cfg.setupFeeAmount / 100).toLocaleString('en-IN')}`;
  });

  readonly canEditRegistration = computed(() => {
    const status = this.onboardingStatus();
    // ── FIX 2: canEditRegistration no longer requires inviteToken to be set ──
    // We always have schoolCode; token is fetched async. The edit action itself
    // will re-check and wait if needed.
    return status === 'REGISTERED' || status === 'PAYMENT_SUBMITTED';
  });

  readonly isPaymentPending = computed(
    () =>
      this.onboardingStatus() === 'PAYMENT_SUBMITTED' &&
      this.paymentRecord()?.status === 'SUBMITTED'
  );

  readonly isPaymentRejected = computed(() => this.paymentRecord()?.status === 'REJECTED');

  paymentForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastService
  ) {
    this.paymentForm = this.fb.group({
      utrNumber: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]],
      payerName: ['', [Validators.required, Validators.minLength(2)]],
      payerPhone: [''],
      amountPaidPaise: [0],
    });
  }

  ngOnInit() {
    this.schoolCode = this.route.snapshot.queryParamMap.get('code') || '';
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) this.inviteToken.set(token);

    if (!this.schoolCode) {
      this.error.set('Missing school code. Please use the link from your registration email.');
      this.loading.set(false);
      return;
    }
    this.loadPaymentStatus();
  }

  loadPaymentStatus() {
    this.loading.set(true);
    this.api.get<any>(`school/auth/payment-status/${this.schoolCode}`).subscribe({
      next: (res) => {
        if (!res.success) {
          this.error.set('Failed to load payment details');
        } else {
          this.paymentStatus.set(res);

          const fee = res.paymentConfig?.setupFeeAmount;
          if (fee) {
            this.paymentForm.patchValue({ amountPaidPaise: fee });
          }

          if (res.school?.isActive) {
            this.toast.success('Your account is already active! Please log in.');
            this.router.navigate(['/login']);
            return;
          }

          const status = res.school?.onboardingStatus;
          if (status === 'REGISTERED' || status === 'PAYMENT_SUBMITTED') {
            this.loadRegisteredDetails();
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load payment status. Please try again.');
        this.loading.set(false);
      },
    });
  }

  loadRegisteredDetails() {
    const token = this.inviteToken();
    if (!token) {
      // No token in URL — fetch from school code endpoint which also returns the token
      this.fetchTokenFromSchoolCode();
      return;
    }
    this.fetchRegistrationDetailsByToken(token);
  }

  private fetchTokenFromSchoolCode() {
    this.loadingDetails.set(true);
    this.api.get<any>(`school/auth/registration-details/${this.schoolCode}`).subscribe({
      next: (res) => {
        if (res.success && res.details) {
          this.registeredDetails.set(res.details);
        }
        // ── FIX 3: always persist the token returned by this endpoint ─────────
        // registration-details/:schoolCode returns `inviteToken` so subsequent
        // calls to editRegistration() have it available synchronously.
        if (res.inviteToken) {
          this.inviteToken.set(res.inviteToken);
        }
        this.loadingDetails.set(false);
      },
      error: () => {
        console.warn('Could not load registration details');
        this.loadingDetails.set(false);
      },
    });
  }

  private fetchRegistrationDetailsByToken(token: string) {
    this.loadingDetails.set(true);
    this.api.get<any>(`school/auth/validate-invite/${token}`).subscribe({
      next: (res) => {
        if (res.valid && res.registeredDetails) {
          this.registeredDetails.set(res.registeredDetails);
        }
        this.loadingDetails.set(false);
      },
      error: () => {
        this.loadingDetails.set(false);
      },
    });
  }

  toggleDetailsPanel() {
    this.showDetailsPanel.update((v) => !v);
  }

  // ── FIX 4: editRegistration — handle missing token gracefully ─────────────
  // If token is still null (details endpoint hasn't responded yet, or the
  // endpoint didn't return one), fall back to re-fetching it first, then
  // navigate once it resolves.
  editRegistration() {
    const token = this.inviteToken();

    if (token) {
      this.router.navigate(['/school/register'], {
        queryParams: { token, edit: '1' },
      });
      return;
    }

    // Token not yet available — fetch it, then navigate
    this.toast.info('Loading your registration details…');
    this.api.get<any>(`school/auth/registration-details/${this.schoolCode}`).subscribe({
      next: (res) => {
        const fetchedToken = res.inviteToken;
        if (fetchedToken) {
          this.inviteToken.set(fetchedToken);
          this.router.navigate(['/school/register'], {
            queryParams: { token: fetchedToken, edit: '1' },
          });
        } else {
          this.toast.error(
            'Cannot edit registration — invite token not found. Please contact support.'
          );
        }
      },
      error: () => {
        this.toast.error('Failed to load registration link. Please try again.');
      },
    });
  }

  copyUpiId() {
    const upi = this.paymentConfig()?.upiId;
    if (!upi) return;
    navigator.clipboard.writeText(upi).then(() => {
      this.copiedUpi.set(true);
      setTimeout(() => this.copiedUpi.set(false), 2500);
    });
  }

  submitPayment() {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const amountPaise = this.paymentForm.value.amountPaidPaise;
    if (!amountPaise || amountPaise <= 0) {
      this.toast.error('Payment amount not configured. Please refresh the page.');
      return;
    }

    this.submitting.set(true);
    const raw = this.paymentForm.value;

    const payload: any = {
      schoolCode: this.schoolCode,
      utrNumber: raw.utrNumber.trim(),
      payerName: raw.payerName.trim(),
      amountPaid: amountPaise,
    };
    if (raw.payerPhone?.trim()) payload.payerPhone = raw.payerPhone.trim();

    this.api.post<any>('school/auth/submit-payment', payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Payment submitted! We will verify within 24 hours.');
          this.loadPaymentStatus();
        } else {
          this.toast.error(res.error || 'Failed to submit payment');
        }
        this.submitting.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to submit. Please try again.');
        this.submitting.set(false);
      },
    });
  }

  fieldInvalid(name: string): boolean {
    const ctrl = this.paymentForm.get(name);
    return !!(ctrl?.touched && ctrl?.invalid);
  }

  get schoolInitial(): string {
    return this.paymentStatus()?.school.name?.charAt(0)?.toUpperCase() ?? '?';
  }
}
