// theme.service.ts
import { isPlatformBrowser } from '@angular/common';
import {
  inject,
  Injectable,
  PLATFORM_ID,
  Renderer2,
  RendererFactory2,
  signal,
} from '@angular/core';

export interface ThemeConfig {
  id?: number;
  themeName: string;
  config: Record<string, string>;
  isCustomTheme: boolean;
}

export interface ThemeListItem {
  id: number;
  themeName: string;
  isCustomTheme: boolean;
  isActive: boolean;
  createdAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dark mode overrides applied on TOP of any school theme.
//
// WHY THIS IS NEEDED:
// ThemeService.applyConfigToRoot() writes CSS variables as *inline styles* on
// <html> via style.setProperty(). Inline styles have the highest specificity —
// they beat [data-theme="dark"] { --color-bg-card: ... } in any stylesheet.
// So toggling data-theme alone never wins against the already-applied school
// theme variables.
//
// Solution: when dark mode is enabled we also call setProperty() directly for
// every surface/text/interactive token that must change in dark mode, giving
// them the same specificity as the school theme tokens.
// When dark mode is disabled we remove those overrides so the school theme
// (or stylesheet fallbacks) take back control.
// ─────────────────────────────────────────────────────────────────────────────
const DARK_OVERRIDES: Record<string, string> = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  '--color-bg-main': '#0d1117',
  '--color-bg-surface': '#161b27',
  '--color-bg-card': '#1e2433',

  // ── Borders & Dividers ────────────────────────────────────────────────────
  '--color-border': '#2d3748',
  '--color-divider': '#252d3d',

  // ── Typography ────────────────────────────────────────────────────────────
  '--color-text-primary': '#f1f5f9',
  '--color-text-secondary': '#94a3b8',
  '--color-text-muted': '#64748b',

  // ── Brand (brightened so they're readable on dark bg) ─────────────────────
  '--color-primary': '#60a5fa',
  '--color-primary-light': '#93c5fd',
  '--color-primary-dark': '#3b82f6',
  '--color-on-primary': '#0f172a',
  '--color-secondary': '#a78bfa',
  '--color-on-secondary': '#0f172a',

  // ── Semantic (softened for dark bg) ───────────────────────────────────────
  '--color-success': '#34d399',
  '--color-warning': '#fbbf24',
  '--color-error': '#f87171',
  '--color-info': '#60a5fa',

  // ── Interactive States ────────────────────────────────────────────────────
  '--color-hover': '#1e2d3d',
  '--color-active': '#1e3a5f',

  // ── Shadows ───────────────────────────────────────────────────────────────
  '--shadow-sm': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  '--shadow-md': '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.3)',
  '--shadow-lg': '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.4)',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private renderer: Renderer2;
  private platformId = inject(PLATFORM_ID);

  private readonly THEME_KEY = 'schoolTheme';
  private readonly DARK_MODE_KEY = 'darkMode';

  // ── Reactive signals ───────────────────────────────────────────────────────
  /** Currently active theme name (for UI highlights in settings) */
  activeThemeName = signal<string | null>(null);

  /** Single source of truth for dark mode state across ALL components */
  isDarkMode = signal(false);

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    // Load saved theme immediately on service construction (SSR-safe)
    this.loadSavedTheme();
  }

  // ── Apply theme from API response (login / school-code-entry) ─────────────
  /**
   * Call this immediately after school code validation returns a theme.
   * Stores the theme in localStorage and injects all CSS variables into :root.
   */
  applySchoolTheme(theme: ThemeConfig | null): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!theme?.config) {
      this.resetToDefault();
      return;
    }

    // Persist for page refresh
    localStorage.setItem(this.THEME_KEY, JSON.stringify(theme));

    // Apply school theme base tokens
    this.applyConfigToRoot(theme.config);

    // If dark mode is already active, re-apply dark overrides on top so the
    // newly applied school theme tokens don't wipe out dark mode appearance.
    if (this.isDarkMode()) {
      this.applyDarkOverrides();
    }

    this.activeThemeName.set(theme.themeName);
  }

  // ── Apply a theme the user just switched to (settings page) ───────────────
  /**
   * Used by the settings page after calling the activate API.
   * Writes to localStorage and updates CSS variables immediately —
   * no page reload needed.
   */
  switchTheme(theme: ThemeConfig): void {
    this.applySchoolTheme(theme);
  }

  // ── Load saved theme on app boot ──────────────────────────────────────────
  /**
   * Called in constructor so theme is applied as early as possible.
   * Re-applies the persisted theme + dark mode so users see correct state instantly.
   * Safe to call multiple times (idempotent).
   */
  loadSavedTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;
  
    // ── Restore color theme ────────────────────────────────────────────────
    const saved = localStorage.getItem(this.THEME_KEY);
    if (saved) {
      try {
        const theme: ThemeConfig = JSON.parse(saved);
        this.applyConfigToRoot(theme.config);          // ← always apply first
        this.activeThemeName.set(theme.themeName);
      } catch {
        this.resetToDefault();
      }
    }
  
    // ── Restore dark mode ─────────────────────────────────────────────────
    // Apply data-theme attribute AND inline var overrides in one place.
    // Previously the light branch called removeDarkOverrides but not
    // reapplySchoolTheme, so school theme vars set by applyConfigToRoot
    // above could get wiped during a race with applySchoolTheme().
    const dark = localStorage.getItem(this.DARK_MODE_KEY);
    const isDark = dark === 'dark';
  
    this.isDarkMode.set(isDark);
    this.renderer.setAttribute(
      document.documentElement,
      'data-theme',
      isDark ? 'dark' : 'light'
    );
  
    if (isDark) {
      // Dark overrides sit on top of the school theme vars applied above.
      this.applyDarkOverrides();
    } else {
      // Remove any leftover dark overrides, then re-assert school theme vars
      // so they are never absent regardless of call order.
      this.removeDarkOverrides();
      this.reapplySchoolTheme();   // ← THE KEY FIX
    }
  }

  // ── Dark mode ─────────────────────────────────────────────────────────────
  toggleDarkMode(): void {
    this.setDarkMode(!this.isDarkMode());
  }

  setDarkMode(enabled: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.isDarkMode.set(enabled);

    if (enabled) {
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'dark');
      localStorage.setItem(this.DARK_MODE_KEY, 'dark');
      // Apply dark variable overrides inline — beats school theme inline styles.
      this.applyDarkOverrides();
    } else {
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'light');
      localStorage.setItem(this.DARK_MODE_KEY, 'light');
      // Remove dark overrides so school theme tokens take back control.
      this.removeDarkOverrides();
      // Re-apply school theme to restore original token values cleanly.
      this.reapplySchoolTheme();
    }
  }

  // ── Clear everything (school logout / change school) ─────────────────────
  clearTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    localStorage.removeItem(this.THEME_KEY);
    localStorage.removeItem(this.DARK_MODE_KEY);
    this.renderer.removeAttribute(document.documentElement, 'data-theme');
    this.activeThemeName.set(null);
    this.isDarkMode.set(false);

    // Remove all injected CSS variables
    this.resetToDefault();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private applyConfigToRoot(config: Record<string, string>): void {
    Object.entries(config).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }

  /**
   * Apply DARK_OVERRIDES as inline styles on <html>.
   * Inline styles always win over stylesheet rules, so these override
   * any school-theme tokens that were set the same way.
   */
  private applyDarkOverrides(): void {
    Object.entries(DARK_OVERRIDES).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }

  /**
   * Remove DARK_OVERRIDES from <html> inline styles.
   * After removal, the school theme tokens (also inline) take back control.
   */
  private removeDarkOverrides(): void {
    Object.keys(DARK_OVERRIDES).forEach((key) => {
      document.documentElement.style.removeProperty(key);
    });
  }

  /**
   * Re-apply the persisted school theme tokens (light mode restore).
   * Called when switching from dark → light so school theme colors come back.
   */
  private reapplySchoolTheme(): void {
    const saved = localStorage.getItem(this.THEME_KEY);
    if (!saved) return;
    try {
      const theme: ThemeConfig = JSON.parse(saved);
      this.applyConfigToRoot(theme.config);
    } catch {
      // ignore — stylesheet fallbacks take over
    }
  }

  private resetToDefault(): void {
    // Remove all inline CSS variables so stylesheet :root fallbacks apply. (26)
    const allVars = [
      ...Object.keys(DARK_OVERRIDES),
      '--color-primary',
      '--color-primary-light',
      '--color-primary-dark',
      '--color-on-primary',
      '--color-secondary',
      '--color-on-secondary',
      '--color-success',
      '--color-warning',
      '--color-error',
      '--color-info',
      '--color-bg-main',
      '--color-bg-surface',
      '--color-bg-card',
      '--color-border',
      '--color-divider',
      '--color-text-primary',
      '--color-text-secondary',
      '--color-text-muted',
      '--color-hover',
      '--color-active',
      '--shadow-sm',
      '--shadow-md',
      '--shadow-lg',
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
    ];

    // Deduplicate in case of overlap with DARK_OVERRIDES keys
    [...new Set(allVars)].forEach((v) => {
      document.documentElement.style.removeProperty(v);
    });

    this.activeThemeName.set(null);
  }
}
