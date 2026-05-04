// theme-settings.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ThemeConfig, ThemeListItem } from './theme.service';

export interface CreateCustomThemePayload {
  themeName: string;
  config: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class ThemeSettingsService {
  constructor(private api: ApiService) {}

  /**
   * ✅ NEW: Fetch the currently active theme including its full CSS config map.
   * Used by ThemeSettings component after activation to immediately apply
   * the new theme to :root without a page reload.
   * Route: GET /school/settings/theme
   */
  getActiveTheme(): Observable<{ success: boolean; theme: ThemeConfig | null }> {
    return this.api.get<{ success: boolean; theme: ThemeConfig | null }>('school/settings/theme');
  }

  /** All predefined + custom themes for this school */
  getAllThemes(): Observable<{ themes: ThemeListItem[] }> {
    return this.api.get<{ themes: ThemeListItem[] }>('school/settings/themes');
  }

  /** Activate a theme by its ID */
  activateTheme(themeId: number): Observable<{ success: boolean; message: string }> {
    return this.api.post('school/settings/theme/activate', { themeId });
  }

  /** Create a new custom theme */
  createCustomTheme(
    payload: CreateCustomThemePayload
  ): Observable<{ success: boolean; theme: ThemeListItem }> {
    return this.api.post('school/settings/theme/custom', payload);
  }

  /** Delete a custom theme by ID */
  deleteCustomTheme(themeId: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete(`school/settings/theme/custom/${themeId}`);
  }
}
