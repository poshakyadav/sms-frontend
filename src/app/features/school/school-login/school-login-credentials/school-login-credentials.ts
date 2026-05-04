import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs'; // ← FIX 1
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ParentService, ParentChild } from '../../../../core/services/parent.service';
import { ParentChildSelectorComponent } from '../../parents/parent-child-selector/parent-child-selector';

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
  email = signal('');
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

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
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

  async onLogin(): Promise<void> {
    if (this.loading() || !this.schoolInfo()) return;

    const emailVal = this.email().trim();
    const passwordVal = this.password();

    if (!emailVal || !passwordVal) {
      this.error.set('Please enter both email and password.');
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

      // FIX 1: Replace deprecated .toPromise() with lastValueFrom().
      // .toPromise() resolves to `undefined` for empty Observables and has
      // inconsistent error propagation. lastValueFrom() always throws on error,
      // which is exactly what our catch block depends on.
      const res = await lastValueFrom(
        this.auth.schoolLogin(this.schoolInfo()!.code, emailVal, passwordVal, termsPayload)
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
      // FIX 2: Safely parse err.error regardless of whether Angular delivered
      // it as a parsed object or a raw JSON string.
      //
      // Why this happens:
      //   Angular's HttpClient auto-parses the response body as JSON only when
      //   the server sends Content-Type: application/json.  Hono sets this by
      //   default for c.json(), so in practice err.error is always an object —
      //   but we parse defensively because:
      //     a) a proxy or CDN could strip/alter Content-Type headers, and
      //     b) network errors produce err.error as a ProgressEvent, not JSON.
      const body = this.parseErrorBody(err);

      if (body?.requiresTermsAcceptance === true) {
        // Backend confirmed credentials are valid but T&C not yet accepted.
        // Show the checkbox — credentials stay filled so the user just checks
        // and re-submits without re-typing anything.
        this.showTermsCheckbox.set(true);
        this.termsAccepted.set(false); // FIX 3: reset in case of retry
        this.error.set('Please accept the Terms & Conditions and Privacy Policy to continue.');
        // No toast — inline error is sufficient for a one-time consent step.
        return;
      }

      // All other errors (wrong password, deactivated account, network, etc.)
      const msg = body?.error ?? 'Invalid email or password.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Safely extract a plain object from an Angular HttpErrorResponse.
   *
   * err.error is:
   *   - a parsed object  → when Content-Type is application/json (normal case)
   *   - a string         → when Content-Type is missing / text/plain
   *   - a ProgressEvent  → on network timeout / CORS failures
   */
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
    const baseValid = this.email().trim().length > 0 && this.password().length > 0;
    if (this.showTermsCheckbox()) return baseValid && this.termsAccepted();
    return baseValid;
  }
}
