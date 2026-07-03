// features/super/super.routes.ts
import { Routes } from '@angular/router';
import { superPermissionGuard } from '../../core/guards/permission-guard';
import { SuperLayout } from '../../shared/layouts/super-layout/super-layout';
import { superAuthGuard } from '../../core/guards/permission-guard';

export const SUPER_ROUTES: Routes = [
  {
    path: '',
    component: SuperLayout,
    canActivate: [superAuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Dashboard ──────────────────────────────────────────────────────────
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        canActivate: [superPermissionGuard('dashboard.view')],
      },

      // ── Users ──────────────────────────────────────────────────────────────
      {
        path: 'users',
        children: [
          {
            path: '',
            loadComponent: () => import('./users/users/users').then((m) => m.Users),
            canActivate: [superPermissionGuard('users.list')],
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./users/user-create/user-create').then((m) => m.UserCreate),
            canActivate: [superPermissionGuard('users.create')],
          },
          {
            path: 'edit/:id',
            loadComponent: () => import('./users/user-edit/user-edit').then((m) => m.UserEdit),
            canActivate: [superPermissionGuard('users.list')], // fine-grained gating inside component
          },
        ],
      },

      // ── Roles ──────────────────────────────────────────────────────────────
      {
        path: 'roles',
        loadComponent: () => import('./roles/roles').then((m) => m.Roles),
        canActivate: [superPermissionGuard('roles.manage')],
      },

      // ── Schools ────────────────────────────────────────────────────────────
      {
        path: 'schools',
        loadComponent: () =>
          import('./schools-component/schools-component').then((m) => m.SchoolsComponent),
        canActivate: [superPermissionGuard(['schools.list', 'schools.manage'])],
      },

      // ── Turso DBs ──────────────────────────────────────────────────────────
      {
        path: 'turso-dbs',
        loadComponent: () =>
          import('./turso-dbs-component/turso-dbs-component').then((m) => m.TursoDbsComponent),
        canActivate: [superPermissionGuard('turso.manage')],
      },

      // ── Invitations ────────────────────────────────────────────────────────
      {
        path: 'invitations',
        loadComponent: () =>
          import('./invitations/invitations/invitations').then((m) => m.Invitations),
        canActivate: [superPermissionGuard('schools.invite')],
      },

      // ── Approvals ──────────────────────────────────────────────────────────
      {
        path: 'approvals',
        loadComponent: () => import('./approvals/approvals/approvals').then((m) => m.Approvals),
        canActivate: [superPermissionGuard('schools.manage')],
      },

      // ── Payment config ────────────────────────────────────────────────────
      {
        path: 'payment-config',
        loadComponent: () =>
          import('./payment-config/payment-config/payment-config').then(
            (m) => m.PaymentConfigComponent
          ),
        canActivate: [superPermissionGuard('payments.config')],
      },

      // ── Access Plans (pricing configuration) ──────────────────────────────
      {
        path: 'access-plans',
        loadComponent: () =>
          import('./access-plans-management/access-plans-management').then(
            (m) => m.AccessPlansManagement
          ),
        canActivate: [superPermissionGuard(['access-plans.view', 'access-plans.manage'])],
      },

      // ── School registration requests ──────────────────────────────────────
      {
        path: 'school-requests',
        loadComponent: () =>
          import('./school-requests/school-requests').then((m) => m.SchoolRequests),
        canActivate: [superPermissionGuard('school-requests.view')],
      },

      // ── Contact / support messages ────────────────────────────────────────
      {
        path: 'contact-messages',
        loadComponent: () =>
          import('./contact-messages/contact-messages').then((m) => m.ContactMessages),
        canActivate: [superPermissionGuard('contact-messages.view')],
      },

      // ── Permission sync ───────────────────────────────────────────────────
      {
        path: 'permission-sync',
        loadComponent: () =>
          import('./school-permission-sync/permission-sync/permission-sync').then(
            (m) => m.PermissionSync
          ),
        canActivate: [superPermissionGuard('schools.manage')],
      },
    ],
  },
];
