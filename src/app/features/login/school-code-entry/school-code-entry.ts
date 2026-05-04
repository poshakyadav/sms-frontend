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

  // Features shown in the left panel
  readonly features = [
    'Attendance tracking & reports',
    'Exam & assignment management',
    'Fee collection & ledger',
    'Multi-role access control',
  ];

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
 
    // ✅ FIX: Always reset to default (app) styles when landing on the code-entry
    // page. Without this, a user who previously logged into School A would still
    // see School A's brand colors on this neutral page if they navigated back or
    // opened a new tab while still having the old theme in localStorage.
    // clearTheme() removes the stored theme key AND removes all --color-* CSS
    // variables from :root, so the global styles.scss :root fallbacks take over.
    this.themeService.clearTheme();
 
    // Auto-fill and validate if user has visited before
    const saved = localStorage.getItem('schoolCode')?.trim();
    if (saved) {
      this.schoolCode.set(saved.toUpperCase());
      this.validateAndProceed(saved);
    }
  }

  // Live uppercase as user types
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); // Strip invalid chars immediately
    this.schoolCode.set(value);
    (event.target as HTMLInputElement).value = value; // Reflect back
    if (this.error()) this.error.set(''); // Clear stale error on type
  }

  onSubmit(): void {
    if (this.loading()) return;
    this.validateAndProceed(this.schoolCode());
  }

  private async validateAndProceed(code: string): Promise<void> {
    const trimmed = code.trim().toUpperCase();

    // Client-side guard
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
        // Persist school code for next visit
        localStorage.setItem('schoolCode', res.school.code);

        // ── Apply school theme BEFORE navigating ─────────────────────────
        // ThemeService writes all --color-* CSS vars to :root immediately,
        // so the credentials page renders with the school's brand instantly.
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
        const msg = res?.error ?? 'Invalid school code. Please try again.';
        this.error.set(msg);
        this.toast.error(msg);
      }
    } catch (err: any) {
      const msg =
        err?.status === 0
          ? 'Network error — please check your connection.'
          : 'Unable to validate right now. Please try again.';
      this.error.set(msg);
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
