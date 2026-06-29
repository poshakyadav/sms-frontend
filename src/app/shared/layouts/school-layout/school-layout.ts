// school-layout.ts

import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SchoolHeader } from '../../components/school-header/school-header';
import { SchoolSidebar } from '../../components/school-sidebar/school-sidebar';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { ParentService } from '../../../core/services/parent.service';
import { ThemeSettingsService } from '../../../core/services/theme-settings.service';
import { AccessExpiryBanner } from '../../../features/school/billing/components/access-expiry-banner/access-expiry-banner';

@Component({
  selector: 'app-school-layout',
  imports: [RouterOutlet, SchoolHeader, SchoolSidebar, AccessExpiryBanner],
  templateUrl: './school-layout.html',
  styleUrl: './school-layout.scss',
})
export class SchoolLayout implements OnInit {
  @ViewChild(SchoolSidebar) sidebar!: SchoolSidebar;

  private platformId = inject(PLATFORM_ID);
  private themeService = inject(ThemeService);
  private auth = inject(AuthService);
  private parentService = inject(ParentService);
  private themeSettingsService = inject(ThemeSettingsService);

  constructor() {
    // Apply saved theme as early as possible — before any child route renders.
    // if (isPlatformBrowser(this.platformId)) {
    //   this.themeService.loadSavedTheme();
    // }
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // This restores the theme from localStorage (handles page refresh correctly)
    // this.themeService.loadSavedTheme();

    // ── Fallback: if no theme was applied yet (first login, cleared storage),
    // fetch from backend and apply. This also handles the case where
    // saveSchoolAuth() received no theme in the login response.
    if (!this.themeService.activeThemeName()) {
      this.themeSettingsService.getActiveTheme().subscribe({
        next: (res) => {
          if (res.theme) {
            this.themeService.applySchoolTheme(res.theme);
          }
        },
        error: () => {}, // non-fatal — app still works with default theme
      });
    }

    // ── Parent child-switcher refresh fix ─────────────────────────────────
    // ParentService already rehydrates _children from localStorage in its
    // constructor, so the switcher renders instantly. We still fire a
    // background API call here to keep the list fresh (role changes, new
    // children added by admin, etc.).
    //
    // We only do this when the user is STUDENT_PARENT to avoid unnecessary
    // network requests for every other role.
    if (this.auth.userRole() === 'STUDENT_PARENT') {
      this.parentService.loadChildren().subscribe({
        error: (err) => {
          // Non-fatal — the cached list from localStorage is still shown.
          // Don't toast here; the layout shouldn't surface auth errors.
          console.warn('[SchoolLayout] Failed to refresh parent children:', err);
        },
      });
    }
  }

  /** Called by the hamburger button in SchoolHeader via event emitter. */
  openMobileSidebar(): void {
    this.sidebar?.toggleMobile();
  }
}
