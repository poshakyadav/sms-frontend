// school-login-credentials.ts
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ParentService, ParentChild } from '../../../../core/services/parent.service';
import { ParentChildSelectorComponent } from '../../parents/parent-child-selector/parent-child-selector';
import { AuthFooter } from '../../../../shared/components/auth-footer/auth-footer';
import { VALIDATED_SCHOOL_KEY } from '../../../login/school-code-entry/school-code-entry';

interface LoginErrorBody {
  requiresTermsAcceptance?: boolean;
  error?: string;
  onboardingStatus?: string;
  requiresPayment?: boolean;
  paymentPending?: boolean;
}

interface SchoolInfo {
  name: string;
  code: string;
  logoUrl: string | null;
  tagline: string | null;
}

// Loose email sniff — just enough to route to the right request field.
// Doesn't need to be a full RFC validator; the backend validates for real.
const EMAIL_LIKE_PATTERN = /\S+@\S+\.\S+/;

@Component({
  selector: 'app-school-login-credentials',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ParentChildSelectorComponent,
    AuthFooter,
  ],
  templateUrl: './school-login-credentials.html',
  styleUrl: './school-login-credentials.scss',
})
export class SchoolLoginCredentials implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly themeService = inject(ThemeService);
  private parentService = inject(ParentService);

  // ── UI state ──────────────────────────────────────────────────────────────
  schoolInfo = signal<SchoolInfo | null>(null);

  // Single combined field — can hold either an email or a username.
  // Renamed from `email` since it's no longer email-only.
  identifier = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  // parent child selector state
  showChildSelector = signal(false);
  pendingChildren = signal<ParentChild[]>([]);

  // ── T&C state ─────────────────────────────────────────────────────────────
  showTermsCheckbox = signal(false);
  termsAccepted = signal(false);

  activeThemeName = this.themeService.activeThemeName;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const code = params['schoolCode'];
      if (!code) {
        this.router.navigate(['/login']);
        return;
      }
      this.schoolInfo.set({
        name: params['schoolName'] || 'School Portal',
        code: code,
        logoUrl: params['logoUrl'] || null,
        tagline: params['tagline'] || null,
      });
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  onIdentifierInput(event: Event): void {
    this.identifier.set((event.target as HTMLInputElement).value);
    if (this.error()) this.error.set('');
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    if (this.error()) this.error.set('');
  }

  onTermsToggle(event: Event): void {
    this.termsAccepted.set((event.target as HTMLInputElement).checked);
    if (this.error()) this.error.set('');
  }

  private isEmailLike(value: string): boolean {
    return EMAIL_LIKE_PATTERN.test(value);
  }

  async onLogin(): Promise<void> {
    if (this.loading() || !this.schoolInfo()) return;

    const identifierVal = this.identifier().trim();
    const passwordVal = this.password();

    if (!identifierVal || !passwordVal) {
      this.error.set('Please enter your email or username, and your password.');
      return;
    }

    if (this.showTermsCheckbox() && !this.termsAccepted()) {
      this.error.set('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    this.error.set('');
    this.loading.set(true);

    try {
      const termsPayload = this.showTermsCheckbox() ? this.termsAccepted() : undefined;

      // Route to the right backend field based on what was typed — the
      // backend accepts either `email` or `username` alongside `password`.
      const loginIdentifier = this.isEmailLike(identifierVal)
        ? { email: identifierVal.toLowerCase() }
        : { username: identifierVal.toLowerCase() };

      const res = await lastValueFrom(
        this.auth.schoolLogin(this.schoolInfo()!.code, loginIdentifier, passwordVal, termsPayload)
      );

      if (res?.success) {
        if (res.children && Array.isArray(res.children) && res.children.length > 0) {
          this.parentService.initFromLoginResponse(res.children);

          if (res.children.length === 1) {
            this.parentService.setActiveChild(res.children[0].studentId);
            this.toast.success(`Welcome back, ${res.user?.name ?? 'User'}!`);
            this.router.navigate(['/school/dashboard']);
          } else {
            this.pendingChildren.set(res.children);
            this.showChildSelector.set(true);
          }
          return;
        }

        this.toast.success(`Welcome back, ${res.user?.name ?? 'User'}!`);
        this.router.navigate(['/school/dashboard']);
      }
    } catch (err: any) {
      const body = this.parseErrorBody(err);

      if (body?.requiresTermsAcceptance === true) {
        this.showTermsCheckbox.set(true);
        this.termsAccepted.set(false);
        this.error.set('Please accept the Terms & Conditions and Privacy Policy to continue.');
        return;
      }

      // Backend already returns a method-aware message ("Invalid username or
      // password" vs "Invalid email or password") — just surface it.
      const msg = body?.error ?? 'Invalid email/username or password.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  private parseErrorBody(err: any): LoginErrorBody | null {
    const raw = err?.error;
    if (raw && typeof raw === 'object' && !(raw instanceof ProgressEvent)) {
      return raw as LoginErrorBody;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as LoginErrorBody;
      } catch {
        return null;
      }
    }
    return null;
  }

  onChildSelected(child: ParentChild): void {
    this.showChildSelector.set(false);
    this.pendingChildren.set([]);
    this.toast.success(`Welcome back! Viewing ${child.studentName}'s profile.`);
    this.router.navigate(['/school/dashboard']);
  }

  changeSchool(): void {
    localStorage.removeItem('schoolCode');
    localStorage.removeItem(VALIDATED_SCHOOL_KEY); // ← clears the validated cache
    this.themeService.clearTheme();
    this.router.navigate(['/login']);
  }

  getInitials(): string {
    return (this.schoolInfo()?.name ?? '')
      .split(' ')
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get canSubmit(): boolean {
    const baseValid = this.identifier().trim().length > 0 && this.password().length > 0;
    if (this.showTermsCheckbox()) return baseValid && this.termsAccepted();
    return baseValid;
  }
}