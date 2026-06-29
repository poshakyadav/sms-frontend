// src/app/features/school/billing/billing.routes.ts

import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/billing-overview/billing-overview').then((m) => m.BillingOverview),
    canActivate: [permissionGuard('billing.view')],
  },
  {
    path: 'plans',
    loadComponent: () =>
      import('./components/access-plans/access-plans').then((m) => m.AccessPlans),
    canActivate: [permissionGuard('billing.view')],
  },
  {
    path: 'bundles',
    loadComponent: () =>
      import('./components/bundle-purchase/bundle-purchase').then((m) => m.BundlePurchase),
    canActivate: [permissionGuard('billing.view')],
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./components/payment-history/payment-history').then((m) => m.PaymentHistory),
    canActivate: [permissionGuard('billing.view')],
  },
];
