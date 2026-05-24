// features/school/settings/settings.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const SETTINGS_ROUTES: Routes = [
  // ── Settings hub (landing page) ───────────────────────────────────────────
  // Always reachable by authenticated school users.
  // Individual cards inside the hub are filtered by permission.
  {
    path: '',
    loadComponent: () =>
      import('./school-settings-hub/school-settings-hub').then((m) => m.SchoolSettingsHub),
  },

  // ── Theme settings ────────────────────────────────────────────────────────
  {
    path: 'theme',
    loadComponent: () =>
      import('./theme-settings/theme-settings/theme-settings').then((m) => m.ThemeSettings),
    canActivate: [permissionGuard('settings.manage')],
  },

  // ── School info / profile ─────────────────────────────────────────────────
  {
    path: 'info',
    loadComponent: () =>
      import('./school-info/school-info/school-info').then((m) => m.SchoolInfoComponent),
    canActivate: [permissionGuard('settings.manage')],
  },

  // ── About Us editor ───────────────────────────────────────────────────────
  {
    path: 'about-us',
    loadComponent: () => import('./about-us-editor/about-us-editor').then((m) => m.AboutUsEditor),
    canActivate: [permissionGuard('settings.manage')],
  },
];
