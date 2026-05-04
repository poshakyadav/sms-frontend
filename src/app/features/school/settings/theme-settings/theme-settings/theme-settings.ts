// theme-settings.ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ThemeSettingsService } from '../../../../../core/services/theme-settings.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';

interface ThemeListItem {
  id: number;
  themeName: string;
  isCustomTheme: boolean;
  isActive: boolean;
  createdAt?: string;
}

@Component({
  selector: 'app-theme-settings',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './theme-settings.html',
  styleUrl: './theme-settings.scss',
})
export class ThemeSettings implements OnInit {
  // Use ThemeSettingsService (API calls) AND ThemeService (CSS application)
  // Previously only SchoolSettingsService was injected, and ThemeService was
  // injected but never used to actually apply theme changes.
  private themeSettingsService = inject(ThemeSettingsService);
  private themeService = inject(ThemeService);
  private toast = inject(ToastService);

  themes = signal<ThemeListItem[]>([]);
  activeThemeId = signal<number | null>(null);
  loading = signal(false);

  // Custom theme creation
  customThemeName = signal('');
  // Store the raw JSON string the user types in the textarea
  customThemeConfigJson = signal('');
  customThemeJsonError = signal('');

  // Delete confirmation
  pendingDeleteId = signal<number | null>(null);

  /** True when there are NO custom themes (covers empty list + no custom items) */
  hasNoCustomThemes = computed(() => {
    return !this.themes().some((t) => t.isCustomTheme);
  });

  ngOnInit(): void {
    this.loadThemes();
  }

  // ── Load all themes ───────────────────────────────────────────────────────

  async loadThemes(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.themeSettingsService.getAllThemes().toPromise();
      if (res?.themes) {
        this.themes.set(res.themes);
        const active = res.themes.find((t) => t.isActive);
        if (active) this.activeThemeId.set(active.id);
      }
    } catch {
      this.toast.error('Failed to load themes');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Activate a theme ──────────────────────────────────────────────────────

  /**
   * ✅ FIX: After calling the activate API we must:
   * 1. Fetch the full theme config from the server.
   * 2. Pass the full config to ThemeService.switchTheme() so CSS vars update
   *    immediately without a page reload.
   * 3. Persist the new theme to localStorage (ThemeService handles this).
   *
   * Previously: only called the activate endpoint and refreshed the list.
   * The CSS variables on :root were never touched, so the UI never changed.
   */
  async activateTheme(themeId: number): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);

    try {
      const activateRes = await this.themeSettingsService.activateTheme(themeId).toPromise();
      if (!activateRes?.success) {
        this.toast.error('Failed to activate theme');
        return;
      }

      // Fetch FULL config (the only endpoint that returns the CSS map)
      const activeThemeRes = await this.fetchActiveThemeConfig();
      if (activeThemeRes) {
        this.themeService.switchTheme(activeThemeRes);
      }

      await this.loadThemes(); // refresh UI list
      this.toast.success('Theme activated successfully');
    } catch {
      this.toast.error('Failed to activate theme');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Create custom theme ───────────────────────────────────────────────────

  async createCustomTheme(): Promise<void> {
    const name = this.customThemeName().trim();
    if (!name) {
      this.toast.error('Please enter a theme name');
      return;
    }

    // Parse and validate the JSON config the user typed
    const config = this.parseCustomConfig();
    if (!config) return; // parseCustomConfig sets the error signal

    if (Object.keys(config).length === 0) {
      this.toast.error('Config must have at least one CSS variable');
      return;
    }

    this.loading.set(true);
    try {
      const res = await this.themeSettingsService
        .createCustomTheme({ themeName: name, config })
        .toPromise();

      if (res?.success) {
        this.toast.success('Custom theme created!');
        this.customThemeName.set('');
        this.customThemeConfigJson.set('');
        this.customThemeJsonError.set('');
        await this.loadThemes();
      }
    } catch (err: any) {
      this.toast.error(err?.error?.error ?? 'Failed to create custom theme');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Delete custom theme ───────────────────────────────────────────────────

  confirmDelete(themeId: number): void {
    this.pendingDeleteId.set(themeId);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  async deleteTheme(themeId: number): Promise<void> {
    this.pendingDeleteId.set(null);
    this.loading.set(true);
    try {
      const res = await this.themeSettingsService.deleteCustomTheme(themeId).toPromise();
      if (res?.success) {
        this.toast.success('Theme deleted');
        await this.loadThemes();
      }
    } catch (err: any) {
      this.toast.error(err?.error?.error ?? 'Failed to delete theme');
    } finally {
      this.loading.set(false);
    }
  }

  // ── JSON textarea helpers ─────────────────────────────────────────────────

  onConfigJsonInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.customThemeConfigJson.set(value);
    this.customThemeJsonError.set(''); // clear error on every keystroke
  }

  private parseCustomConfig(): Record<string, string> | null {
    const raw = this.customThemeConfigJson().trim();
    if (!raw) {
      this.customThemeJsonError.set('Config JSON is required');
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.customThemeJsonError.set('Must be a JSON object, e.g. { "--color-primary": "#..." }');
        return null;
      }
      // Validate every value is a string
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== 'string') {
          this.customThemeJsonError.set(`Value for "${k}" must be a string`);
          return null;
        }
      }
      return parsed as Record<string, string>;
    } catch {
      this.customThemeJsonError.set('Invalid JSON — check syntax');
      return null;
    }
  }

  // ── Fetch active theme config (CSS variable map) ─────────────────────────

  /**
   * Calls GET /school/settings/theme which returns the full config object.
   * This is the only endpoint that returns the CSS variable map.
   */
  private async fetchActiveThemeConfig(): Promise<{
    themeName: string;
    config: Record<string, string>;
    isCustomTheme: boolean;
  } | null> {
    try {
      // ThemeSettingsService delegates to ApiService — add this method there
      const res = await this.themeSettingsService.getActiveTheme().toPromise();
      return res?.theme ?? null;
    } catch {
      return null;
    }
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  readonly placeholderConfig = JSON.stringify(
    {
      '--color-primary': '#10b981',
      '--color-primary-light': '#34d399',
      '--color-primary-dark': '#059669',
      '--color-on-primary': '#ffffff',
      '--color-secondary': '#f59e0b',
    },
    null,
    2
  );
}
