// school-code-entry.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthFooter } from '../../../shared/components/auth-footer/auth-footer';

interface ValidateSchoolResponse {
  valid: boolean;
  school?: {
    name: string;
    code: string;
    logoUrl: string | null;
    tagline: string | null;
    theme?: {
      themeName: string;
      config: Record<string, string>;
      isCustomTheme: boolean;
    };
  };
  error?: string;
}

// ── Cached-validation shape ──────────────────────────────────────────────
// Stored ONLY after a successful backend validation. Its mere presence means
// "this school code has already been validated" — so school-code-entry can
// skip the network call entirely and jump straight to credentials.
export interface StoredValidatedSchool {
  code: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;


  // theme removed — ThemeService.schoolTheme is the single source of truth
  // and is already restored at app boot via loadSavedTheme(). Caching a
  // theme snapshot here would go stale the moment a school changes its
  // active theme from the settings page, since that flow never touches
  // this key.

  // theme: {
  //   themeName: string;
  //   config: Record<string, string>;
  //   isCustomTheme: boolean;
  // } | null;
}

// Exported so school-login-credentials.ts (changeSchool) can clear the
// exact same key without duplicating the string.
export const VALIDATED_SCHOOL_KEY = 'validatedSchoolInfo';

@Component({
  selector: 'app-school-code-entry',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AuthFooter,
  ],
  templateUrl: './school-code-entry.html',
  styleUrl: './school-code-entry.scss',
})
export class SchoolCodeEntry implements OnInit {
  private router = inject(Router);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  schoolCode = signal('');
  loading = signal(false);
  error = signal('');

  readonly features = [
    'Attendance tracking & reports',
    'Exam & assignment management',
    'Fee collection & ledger',
    'Multi-role access control',
  ];

  // ngOnInit(): void {
  //   if (!isPlatformBrowser(this.platformId)) return;

  //   // ── FIX (issue #2): if we already have a *validated* school cached,
  //   // skip the backend call entirely and go straight to credentials.
  //   // We deliberately do NOT clearTheme() first in this branch — we're about
  //   // to re-apply the same school's theme a line below anyway.
  //   const cached = this.getStoredValidatedSchool();
  //   if (cached) {
  //     if (cached.theme) {
  //       this.themeService.applySchoolTheme(cached.theme);
  //     } else {
  //       this.themeService.clearTheme();
  //     }

  //     this.router.navigate(['/login/credentials'], {
  //       queryParams: {
  //         schoolCode: cached.code,
  //         schoolName: cached.name,
  //         logoUrl: cached.logoUrl ?? '',
  //         tagline: cached.tagline ?? '',
  //       },
  //       replaceUrl: true,
  //     });
  //     return;
  //   }

  //   // No validated cache — this is a genuinely fresh/neutral landing on this
  //   // page (e.g. user clicked "Change school"), so reset to default styles.
  //   this.themeService.clearTheme();

  //   // Best-effort prefill from the legacy plain code (pre-existing users who
  //   // only ever had the old 'schoolCode' key). We DON'T auto-submit this —
  //   // the user still has to hit Continue once so it gets validated and
  //   // upgraded into the cached object above.
  //   const legacyCode = localStorage.getItem('schoolCode')?.trim();
  //   if (legacyCode) {
  //     this.schoolCode.set(legacyCode.toUpperCase());
  //   }
  // }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const cached = this.getStoredValidatedSchool();
    if (cached) {
      // No theme handling here — ThemeService already restored the correct,
      // up-to-date theme from its own `schoolTheme` key during app boot,
      // before this component even ran. Re-applying a cached snapshot here
      // would risk overwriting it with a stale value.
      this.router.navigate(['/login/credentials'], {
        queryParams: {
          schoolCode: cached.code,
          schoolName: cached.name,
          logoUrl: cached.logoUrl ?? '',
          tagline: cached.tagline ?? '',
        },
        replaceUrl: true,
      });
      return;
    }

    // No validated cache — genuinely fresh landing (e.g. "Change school").
    // Safe to reset to default here since there's no persisted school theme
    // context this page should be preserving in this branch.
    this.themeService.clearTheme();

    const legacyCode = localStorage.getItem('schoolCode')?.trim();
    if (legacyCode) {
      this.schoolCode.set(legacyCode.toUpperCase());
    }
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    this.schoolCode.set(value);
    (event.target as HTMLInputElement).value = value;
    if (this.error()) this.error.set('');
  }

  onSubmit(): void {
    if (this.loading()) return;
    this.validateAndProceed(this.schoolCode());
  }

  private async validateAndProceed(code: string): Promise<void> {
    const trimmed = code.trim().toUpperCase();

    if (trimmed.length < 3) {
      this.error.set('School code must be at least 3 characters.');
      return;
    }
    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      this.error.set('Only uppercase letters, numbers and hyphens are allowed.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const res = await this.api
        .get<ValidateSchoolResponse>(`school/auth/validate-school-code/${trimmed}`)
        .toPromise();

      if (res?.valid && res.school) {
        // Legacy key kept for back-compat with anything else reading it.
        localStorage.setItem('schoolCode', res.school.code);

        // ── FIX (issue #2): cache the full validated result, not just the code.
        const toStore: StoredValidatedSchool = {
          code: res.school.code,
          name: res.school.name,
          logoUrl: res.school.logoUrl,
          tagline: res.school.tagline,
          // theme: res.school.theme ?? null,
        };
        localStorage.setItem(VALIDATED_SCHOOL_KEY, JSON.stringify(toStore));

        // This applySchoolTheme call is fine — it's a genuinely fresh fetch,
        // not a cached replay, so it can't go stale. It also writes straight
        // into ThemeService's own `schoolTheme` key, keeping that single
        // source of truth up to date.
        if (res.school.theme) {
          this.themeService.applySchoolTheme(res.school.theme);
        }

        this.router.navigate(['/login/credentials'], {
          queryParams: {
            schoolCode: res.school.code,
            schoolName: res.school.name,
            logoUrl: res.school.logoUrl ?? '',
            tagline: res.school.tagline ?? '',
          },
          replaceUrl: true,
        });
      } else {
        // Backend responded 2xx but valid:false (rare, but handle it)
        const msg = res?.error ?? 'Invalid school code. Please try again.';
        this.error.set(msg);
        this.toast.error(msg);
      }
    } catch (err: any) {
      // ── FIX (issue #1): surface the backend's actual error message
      // (e.g. "School code not found...", "This school account is not yet
      // active.") instead of always falling back to a generic string.
      if (err?.status === 0) {
        const msg = 'Network error — please check your connection.';
        this.error.set(msg);
        this.toast.error(msg);
      } else {
        const backendMsg = this.extractBackendErrorMessage(err);
        const msg = backendMsg || 'Unable to validate right now. Please try again.';
        this.error.set(msg);
        this.toast.error(msg);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private getStoredValidatedSchool(): StoredValidatedSchool | null {
    try {
      const raw = localStorage.getItem(VALIDATED_SCHOOL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.code || !parsed?.name) return null;
      return parsed as StoredValidatedSchool;
    } catch {
      return null;
    }
  }

  // Same pattern used in school-login-credentials.ts's parseErrorBody —
  // ApiService.handleError re-throws the original HttpErrorResponse intact,
  // so err.error is the parsed backend JSON body: { valid, error }.
  private extractBackendErrorMessage(err: any): string | null {
    const raw = err?.error;
    if (raw && typeof raw === 'object' && !(raw instanceof ProgressEvent)) {
      return raw.error ?? null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)?.error ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }
}