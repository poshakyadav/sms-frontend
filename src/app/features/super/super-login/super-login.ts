// src/app/features/super/super-login/super-login.ts
import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChildren,
  QueryList,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

type View = 'login' | 'fp-email' | 'fp-otp' | 'fp-reset' | 'fp-done';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

@Component({
  selector: 'app-super-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './super-login.html',
  styleUrl: './super-login.scss',
})
export class SuperLogin implements OnInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // ── View state ──────────────────────────────────────────────────────────────
  view = signal<View>('login');
  loading = signal(false);
  error = signal('');

  // ── Login fields ────────────────────────────────────────────────────────────
  email = signal('');
  password = signal('');
  showPw = signal(false);

  // ── Forgot password — step 1 (email) ───────────────────────────────────────
  fpEmail = signal('');

  // ── Forgot password — step 2 (OTP) ─────────────────────────────────────────
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  otpComplete = computed(() => this.otpDigits().every((d) => d !== ''));

  // Countdown timer
  resendCountdown = signal(0);
  private countdownInterval?: ReturnType<typeof setInterval>;

  // ── Forgot password — step 3 (new password) ─────────────────────────────────
  resetSessionToken = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showNewPw = signal(false);
  showConfirmPw = signal(false);

  passwordStrength = computed<PasswordStrength>(() => {
    const p = this.newPassword();
    if (!p) return { score: 0, label: '', color: '' };
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    const map = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: '#ef4444' },
      { score: 2, label: 'Fair', color: '#f97316' },
      { score: 3, label: 'Good', color: '#eab308' },
      { score: 4, label: 'Strong', color: '#22c55e' },
      { score: 5, label: 'Very strong', color: '#16a34a' },
    ];
    return map[s] ?? map[4];
  });

  passwordReqs = computed(() => {
    const p = this.newPassword();
    return [
      { text: 'At least 8 characters', met: p.length >= 8 },
      { text: 'One uppercase letter', met: /[A-Z]/.test(p) },
      { text: 'One number', met: /[0-9]/.test(p) },
      { text: 'One special character', met: /[^A-Za-z0-9]/.test(p) },
    ];
  });

  passwordsMatch = computed(
    () => !this.confirmPassword() || this.newPassword() === this.confirmPassword()
  );

  resetFormValid = computed(
    () =>
      this.newPassword().length >= 8 &&
      /[A-Z]/.test(this.newPassword()) &&
      /[0-9]/.test(this.newPassword()) &&
      /[^A-Za-z0-9]/.test(this.newPassword()) &&
      this.newPassword() === this.confirmPassword()
  );

  // ── Setup check ─────────────────────────────────────────────────────────────
  checkingSetup = signal(true);
  setupRequired = signal(false);

  ngOnInit(): void {
    this.auth.checkSetupRequired().subscribe({
      next: (res) => {
        this.setupRequired.set(res.setupRequired);
        this.checkingSetup.set(false);
      },
      error: () => this.checkingSetup.set(false),
    });
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  login(): void {
    if (this.loading()) return;
    this.error.set('');
    this.loading.set(true);

    this.auth.superLogin(this.email(), this.password()).subscribe({
      next: () => this.router.navigate(['/super/dashboard']),
      error: (err: any) => {
        this.error.set(err?.error?.error || err?.message || 'Invalid credentials');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD — STEP 1: REQUEST OTP
  // ═══════════════════════════════════════════════════════════════════════════

  showForgotPassword(): void {
    // Pre-fill email if user already typed it on the login form
    if (this.email()) this.fpEmail.set(this.email());
    this.error.set('');
    this.view.set('fp-email');
  }

  requestOtp(): void {
    if (this.loading()) return;
    const email = this.fpEmail().trim().toLowerCase();
    if (!email) return;

    this.error.set('');
    this.loading.set(true);

    this.auth.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.resetOtpDigits();
        this.view.set('fp-otp');
        this.startResendCountdown(60);
        // Focus first OTP box after view renders
        setTimeout(() => this.focusOtpBox(0), 80);
      },
      error: (err: any) => {
        // Should rarely happen — backend always 200s this endpoint
        this.error.set(err?.error?.error || 'Failed to send code. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD — STEP 2: VERIFY OTP
  // ═══════════════════════════════════════════════════════════════════════════

  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1); // digits only, 1 char
    input.value = val;

    const digits = [...this.otpDigits()];
    digits[index] = val;
    this.otpDigits.set(digits);

    if (val && index < 5) this.focusOtpBox(index + 1);
    if (this.otpComplete()) this.verifyOtp();
  }

  onOtpKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const digits = [...this.otpDigits()];
      if (!digits[index] && index > 0) {
        digits[index - 1] = '';
        this.otpDigits.set(digits);
        this.focusOtpBox(index - 1);
      } else {
        digits[index] = '';
        this.otpDigits.set(digits);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focusOtpBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.focusOtpBox(index + 1);
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 6).split('');
    const padded = [...digits, ...Array(6).fill('')].slice(0, 6);
    this.otpDigits.set(padded);
    if (padded.every((d) => d !== '')) this.verifyOtp();
    else this.focusOtpBox(digits.length < 6 ? digits.length : 5);
  }

  verifyOtp(): void {
    if (this.loading() || !this.otpComplete()) return;
    this.error.set('');
    this.loading.set(true);

    const otp = this.otpDigits().join('');

    this.auth.verifyResetOtp(this.fpEmail(), otp).subscribe({
      next: (res) => {
        this.resetSessionToken.set(res.resetSessionToken);
        this.loading.set(false);
        this.clearCountdown();
        this.view.set('fp-reset');
      },
      error: (err: any) => {
        this.error.set(err?.error?.error || 'Invalid code. Please try again.');
        this.loading.set(false);
        this.resetOtpDigits();
        setTimeout(() => this.focusOtpBox(0), 80);
      },
    });
  }

  resendOtp(): void {
    if (this.resendCountdown() > 0 || this.loading()) return;
    this.resetOtpDigits();
    this.error.set('');
    this.requestOtp();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD — STEP 3: RESET PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════

  submitReset(): void {
    if (this.loading() || !this.resetFormValid()) return;
    this.error.set('');
    this.loading.set(true);

    this.auth
      .resetPassword(this.resetSessionToken(), this.newPassword(), this.confirmPassword())
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.view.set('fp-done');
        },
        error: (err: any) => {
          this.error.set(err?.error?.error || 'Reset failed. Please start over.');
          this.loading.set(false);
        },
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  backToLogin(): void {
    this.clearCountdown();
    this.error.set('');
    this.resetOtpDigits();
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.resetSessionToken.set('');
    this.view.set('login');
  }

  goToLoginFromDone(): void {
    this.backToLogin();
  }

  goToSetup(): void {
    this.router.navigate(['/super/setup']);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private focusOtpBox(index: number): void {
    const inputs = this.otpInputs?.toArray();
    if (inputs?.[index]) inputs[index].nativeElement.focus();
  }

  private resetOtpDigits(): void {
    this.otpDigits.set(['', '', '', '', '', '']);
  }

  private startResendCountdown(seconds: number): void {
    this.clearCountdown();
    this.resendCountdown.set(seconds);
    this.countdownInterval = setInterval(() => {
      const v = this.resendCountdown() - 1;
      this.resendCountdown.set(v);
      if (v <= 0) this.clearCountdown();
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
    this.resendCountdown.set(0);
  }
}
