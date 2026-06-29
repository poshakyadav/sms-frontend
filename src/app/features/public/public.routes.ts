// features/public/public.routes.ts
import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  // ── Informational Pages ────────────────────────────────────────────────────
  {
    path: 'about',
    loadComponent: () => import('./about-us/about-us').then((m) => m.AboutUs),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./terms-and-conditions/terms-and-conditions').then((m) => m.TermsAndConditions),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
  },
  {
    path: 'security',
    loadComponent: () => import('./security-policy/security-policy').then((m) => m.SecurityPolicy),
  },

  // ── School Registration Interest Form (no invite needed) ──────────────────
  {
    path: 'register',
    loadComponent: () =>
      import('./school-registration/school-registration').then((m) => m.SchoolRegistration),
  },

  {
    path: 'pricing',
    loadComponent: () => import('./pricing/pricing').then((m) => m.Pricing),
  },

  {
    path: 'verify/:token',
    loadComponent: () =>
      import('./id-card-verify.component/id-card-verify.component').then((m) => m.IdCardVerifyComponent),
  },
];
