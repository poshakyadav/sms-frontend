// features/school/school-sign-up/school-sign-up.ts

import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CommonModule } from '@angular/common';

interface InvitationInfo {
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
  isFeeEnabled: boolean;
  upiId: string;
  qrCodeUrl?: string;
  feeDescription: string;
}

@Component({
  selector: 'app-school-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './school-sign-up.html',
  styleUrl: './school-sign-up.scss',
})
export class SchoolSignUp implements OnInit {
  signupForm: FormGroup;
  loading = signal(false);
  validating = signal(true);
  error = signal<string | null>(null);

  invitation = signal<InvitationInfo | null>(null);
  paymentConfig = signal<PaymentConfig | null>(null);
  tokenInvalid = signal(false);
  tokenError = signal<string | null>(null);

  currentStep = signal<1 | 2>(1);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  isEditMode = signal(false);
  editModeSchoolCode = signal<string | null>(null);

  // ── Password visibility toggles ────────────────────────────────────────────
  showPassword = signal(false);

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      // Owner info
      ownerName: ['', [Validators.required, Validators.minLength(2)]],
      ownerEmail: ['', [Validators.required, Validators.email]],
      ownerPassword: ['', [Validators.required, Validators.minLength(8)]],
      ownerPhone: [''],
      ownerAlternatePhone: [''],
      // School info
      schoolName: ['', [Validators.required, Validators.minLength(3)]],
      addressLineOne: ['', Validators.required],
      addressLineTwo: [''],
      phone: [''],
      alternatePhone: [''],
      schoolEmail: ['', Validators.email],
      schoolWebsite: [''],
      // T&C — required, must be true
      termsAccepted: [false, [Validators.requiredTrue]],
    });
  }

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    const editMode = this.route.snapshot.queryParamMap.get('edit') === '1';

    if (editMode) {
      this.isEditMode.set(true);
    }

    if (!token) {
      this.tokenInvalid.set(true);
      this.tokenError.set('Invalid registration link. Please use the link from your invite email.');
      this.validating.set(false);
      return;
    }
    this.validateToken(token);
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  validateToken(token: string) {
    this.validating.set(true);
    this.api.get<any>(`school/auth/validate-invite/${token}`).subscribe({
      next: (res) => {
        if (!res.valid) {
          this.tokenInvalid.set(true);
          this.tokenError.set(res.error || 'Invalid invitation');
          this.validating.set(false);
          return;
        }

        // ── Already registered + NOT in edit mode → redirect to payment ──────
        if (res.alreadyRegistered && !this.isEditMode()) {
          if (res.schoolCode) {
            const status = res.invitation?.status;
            const toastMsg =
              status === 'PAYMENT_SUBMITTED'
                ? 'Your payment is under review. Showing current status.'
                : 'You have already registered. Please complete your payment.';
            this.toast.info(toastMsg);
            this.router.navigate(['/school/payment'], {
              queryParams: { code: res.schoolCode, token },
            });
          } else {
            this.tokenInvalid.set(true);
            this.tokenError.set(
              'Your registration is already in progress. Please check your email for the payment link, or contact support.'
            );
            this.validating.set(false);
          }
          return;
        }

        // ── Edit mode: pre-fill form ──────────────────────────────────────────
        if (res.alreadyRegistered && this.isEditMode()) {
          this.invitation.set(res.invitation);
          this.editModeSchoolCode.set(res.schoolCode ?? null);

          const d = res.registeredDetails;
          if (d) {
            this.signupForm.patchValue({
              ownerName: d.ownerName ?? '',
              ownerEmail: d.ownerEmail ?? res.invitation.schoolEmail ?? '',
              ownerPhone: d.ownerPhone ?? '',
              ownerAlternatePhone: d.ownerAlternatePhone ?? '',
              schoolName: d.schoolName ?? res.invitation.schoolName ?? '',
              addressLineOne: d.addressLineOne ?? '',
              addressLineTwo: d.addressLineTwo ?? '',
              phone: d.phone ?? res.invitation.schoolPhone ?? '',
              alternatePhone: d.alternatePhone ?? '',
              schoolEmail: d.schoolEmail ?? '',
              schoolWebsite: d.schoolWebsite ?? '',
            });
          } else {
            this.signupForm.patchValue({
              ownerEmail: res.invitation.schoolEmail ?? '',
              schoolName: res.invitation.schoolName ?? '',
              phone: res.invitation.schoolPhone ?? '',
            });
          }

          this.toast.info('Edit your details below. Your password must be re-entered.');
          this.validating.set(false);
          return;
        }

        // ── Fresh invitation ──────────────────────────────────────────────────
        this.invitation.set(res.invitation);
        this.paymentConfig.set(res.paymentConfig);

        this.signupForm.patchValue({
          ownerEmail: res.invitation.schoolEmail,
          schoolName: res.invitation.schoolName,
          phone: res.invitation.schoolPhone || '',
        });

        this.validating.set(false);
      },
      error: () => {
        this.tokenInvalid.set(true);
        this.tokenError.set(
          'Failed to validate your invitation. Please try again or contact support.'
        );
        this.validating.set(false);
      },
    });
  }

  get step1Valid(): boolean {
    const g = this.signupForm;
    return g.get('ownerName')!.valid && g.get('ownerEmail')!.valid && g.get('ownerPassword')!.valid;
  }

  nextStep() {
    if (!this.step1Valid) {
      ['ownerName', 'ownerEmail', 'ownerPassword'].forEach((f) =>
        this.signupForm.get(f)?.markAsTouched()
      );
      return;
    }

    const ownerAlt = this.signupForm.get('ownerAlternatePhone')?.value?.trim();
    const schoolAlt = this.signupForm.get('alternatePhone')?.value?.trim();
    if (ownerAlt && !schoolAlt) {
      this.signupForm.patchValue({ alternatePhone: ownerAlt });
    }

    this.currentStep.set(2);
    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  prevStep() {
    this.currentStep.set(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    const schoolCode = this.editModeSchoolCode();
    const token = this.invitation()?.token;
    if (schoolCode) {
      this.router.navigate(['/school/payment'], {
        queryParams: { code: schoolCode, ...(token ? { token } : {}) },
      });
    } else {
      this.router.navigate(['/school/payment']);
    }
  }

  signup() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    const raw = this.signupForm.value;

    if (!raw.termsAccepted) {
      this.error.set('Please accept the Terms & Conditions and Privacy Policy.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const inv = this.invitation();
    if (!inv) return;

    const payload: any = {
      inviteToken: inv.token,
      ownerName: raw.ownerName,
      ownerEmail: raw.ownerEmail,
      ownerPassword: raw.ownerPassword,
      schoolName: raw.schoolName,
      addressLineOne: raw.addressLineOne,
      termsAccepted: true,
    };

    if (raw.ownerPhone?.trim()) payload.ownerPhone = raw.ownerPhone.trim();
    if (raw.ownerAlternatePhone?.trim())
      payload.ownerAlternatePhone = raw.ownerAlternatePhone.trim();
    if (raw.addressLineTwo?.trim()) payload.addressLineTwo = raw.addressLineTwo.trim();
    if (raw.phone?.trim()) payload.phone = raw.phone.trim();
    if (raw.alternatePhone?.trim()) payload.alternatePhone = raw.alternatePhone.trim();
    if (raw.schoolEmail?.trim()) payload.schoolEmail = raw.schoolEmail.trim();
    if (raw.schoolWebsite?.trim()) payload.schoolWebsite = raw.schoolWebsite.trim();

    this.api.post<any>('school/auth/signup', payload).subscribe({
      next: (res) => {
        if (res.success) {
          const msg = this.isEditMode()
            ? 'Details updated! Redirecting back to payment…'
            : 'Registration successful! Redirecting to payment…';
          this.toast.success(msg);
          this.router.navigate(['/school/payment'], {
            queryParams: { code: res.schoolCode, token: inv.token },
          });
        } else {
          this.error.set(res.error || 'Signup failed');
          this.toast.error(this.error()!);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  get step2TermsValid(): boolean {
    return this.signupForm.get('termsAccepted')?.value === true;
  }

  get feeFormatted(): string {
    const cfg = this.paymentConfig();
    if (!cfg || !cfg.isFeeEnabled || cfg.setupFeeAmount === 0) return 'Contact support';
    return `₹${(cfg.setupFeeAmount / 100).toLocaleString('en-IN')}`;
  }

  get expiresIn(): string {
    const inv = this.invitation();
    if (!inv) return '';
    const diff = new Date(inv.expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  // Helper for field error state
  fieldInvalid(name: string): boolean {
    const ctrl = this.signupForm.get(name);
    return !!(ctrl?.touched && ctrl?.invalid);
  }
}
