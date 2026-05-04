// theme-settings.ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ThemeService, ThemeListItem } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ApiService } from '../../../../core/services/api.service';
import { ThemeSettingsService } from '../../../../core/services/theme-settings.service';

@Component({
  selector: 'app-theme-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './theme-settings.html',
  styleUrl: './theme-settings.scss',
})
export class ThemeSettings implements OnInit {
  private themeSettingsService = inject(ThemeSettingsService);
  private themeService         = inject(ThemeService);
  private toast                = inject(ToastService);
  private auth                 = inject(AuthService);
  private api                  = inject(ApiService);
  private dialog               = inject(MatDialog);

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('settings.manage'));

  // ── State ─────────────────────────────────────────────────────────────────
  themes      = signal<ThemeListItem[]>([]);
  loading     = signal(true);
  error       = signal<string | null>(null);
  activatingId = signal<number | null>(null);
  deletingId   = signal<number | null>(null);

  /** Reactive: name of the currently active theme (from ThemeService signal) */
  activeThemeName = this.themeService.activeThemeName;

  /** Dark mode reactive state */
  isDarkMode = this.themeService.isDarkMode;

  // Derived lists
  predefinedThemes = computed(() => this.themes().filter((t) => !t.isCustomTheme));
  customThemes     = computed(() => this.themes().filter((t) =>  t.isCustomTheme));

  ngOnInit(): void {
    this.loadThemes();
  }

  loadThemes(): void {
    this.loading.set(true);
    this.error.set(null);

    this.themeSettingsService.getAllThemes().subscribe({
      next:  (res) => { this.themes.set(res.themes ?? []); this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load themes');
        this.loading.set(false);
      },
    });
  }

  isActive(theme: ThemeListItem): boolean {
    // Primary source: signal from ThemeService (live)
    // Fallback: isActive flag from API response
    return this.activeThemeName() === theme.themeName || theme.isActive;
  }

  activateTheme(theme: ThemeListItem): void {
    if (this.isActive(theme)) return; // already active

    this.activatingId.set(theme.id);

    this.themeSettingsService.activateTheme(theme.id).subscribe({
      next: () => {
        // Fetch the full theme config so we can apply CSS variables immediately
        this.api
          .get<{ success: boolean; theme: { themeName: string; config: Record<string, string>; isCustomTheme: boolean } }>(
            'school/settings/theme'
          )
          .subscribe({
            next: (res) => {
              if (res.theme) {
                // Apply immediately — no page reload
                this.themeService.switchTheme(res.theme);
              }
              // Update local active flags
              this.themes.update((list) =>
                list.map((t) => ({ ...t, isActive: t.id === theme.id }))
              );
              this.toast.success(`Theme "${theme.themeName}" activated`);
              this.activatingId.set(null);
            },
          });
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to activate theme');
        this.activatingId.set(null);
      },
    });
  }

  deleteCustomTheme(theme: ThemeListItem): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title:        `Delete "${theme.themeName}"?`,
        message:      'This custom theme will be permanently deleted. This cannot be undone.',
        confirmText:  'Delete',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.deletingId.set(theme.id);

      this.themeSettingsService.deleteCustomTheme(theme.id).subscribe({
        next: () => {
          this.themes.update((l) => l.filter((t) => t.id !== theme.id));
          this.toast.success(`"${theme.themeName}" deleted`);
          this.deletingId.set(null);
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to delete theme');
          this.deletingId.set(null);
        },
      });
    });
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  /** Colour swatches to display on each theme card */
  getSwatches(theme: ThemeListItem): string[] {
    // We don't have config here — show a placeholder gradient based on name
    // Real swatch rendering happens via CSS custom property on the card
    return [];
  }
}