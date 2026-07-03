// app.routes.ts
import { Routes } from '@angular/router';
import { authReadyGuard } from './core/guards/auth-ready-guard';
import { loginGuard, permissionGuard, schoolAuthGuard } from './core/guards/permission-guard';
import { setupPageGuard } from './core/guards/super-setup-guard';
import { PageNotFound } from './shared/components/page-not-found/page-not-found';
import { Unauthorized } from './shared/components/unauthorized/unauthorized';
import { SchoolLayout } from './shared/layouts/school-layout/school-layout';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authReadyGuard],
    children: [
      // ── Root redirect ──────────────────────────────────────────────────────
      { path: '', redirectTo: '/login', pathMatch: 'full' },

      // ══════════════════════════════════════════════════════════════════════
      // AUTH — School login flow
      // ══════════════════════════════════════════════════════════════════════
      {
        path: 'login',
        canActivate: [loginGuard],
        loadChildren: () => import('./features/login/login.routes').then((m) => m.LOGIN_ROUTES),
      },

      // ── Super admin login ──────────────────────────────────────────────────
      {
        path: 'super/login',
        canActivate: [loginGuard],
        loadComponent: () =>
          import('./features/super/super-login/super-login').then((m) => m.SuperLogin),
      },

      // ── Super admin first-run setup ────────────────────────────────────────
      {
        path: 'super/setup',
        canActivate: [setupPageGuard],
        loadComponent: () =>
          import('./features/super/super-setup/super-setup/super-setup').then((m) => m.SuperSetup),
      },

      // ══════════════════════════════════════════════════════════════════════
      // PUBLIC — Informational & registration pages (no auth required)
      // ══════════════════════════════════════════════════════════════════════
      {
        path: 'public',
        loadChildren: () => import('./features/public/public.routes').then((m) => m.PUBLIC_ROUTES),
      },

      // ══════════════════════════════════════════════════════════════════════
      // SCHOOL ONBOARDING FLOW — public routes, no JWT required
      //
      // These 3 routes must stay OUTSIDE the schoolAuthGuard so schools can:
      //   1. Complete their signup via invite link   → /school/onboard
      //   2. Resume payment after closing browser   → /school/payment
      //   3. Check activation status after payment  → /school/payment-status
      //
      // /school/login already lives in the login routes (path: 'login').
      // ══════════════════════════════════════════════════════════════════════

      // Path B entry point — interest form / public registration
      // (existing component, already at /public/register; this alias keeps
      //  backward compatibility with any email links that use /register)
      {
        path: 'register',
        redirectTo: '/public/register',
        pathMatch: 'full',
      },

      // Step 1+2+3+4 wizard — reached via invite email link (?token=<uuid>)
      // Handles: validate token → school details → owner account → payment → activation
      {
        path: 'school/onboard',
        loadComponent: () =>
          import('./features/school/school-onboard/school-onboard').then((m) => m.SchoolOnboard),
      },

      // Payment resume page — reached via payment instructions email (?code=<schoolCode>)
      // School already completed signup but closed browser before paying
      {
        path: 'school/payment',
        loadComponent: () =>
          import('./features/school/school-payment/school-payment/school-payment').then(
            (m) => m.SchoolPayment
          ),
      },

      // Activation polling page — reached after payment is verified (?code=<schoolCode>)
      // Also bookmarkable; auto-polls every 30 seconds
      {
        path: 'school/payment-status',
        loadComponent: () =>
          import('./features/school/school-payment-status/school-payment-status').then(
            (m) => m.SchoolPaymentStatus
          ),
      },

      // ── School sign-up / payment (invite-token based onboarding) ──────────
      // {
      //   path: 'school/register',
      //   loadComponent: () =>
      //     import('./features/school/school-sign-up/school-sign-up').then((m) => m.SchoolSignUp),
      // },
      // {
      //   path: 'school/payment',
      //   loadComponent: () =>
      //     import('./features/school/school-payment/school-payment/school-payment').then(
      //       (m) => m.SchoolPayment
      //     ),
      // },

      // ══════════════════════════════════════════════════════════════════════
      // SCHOOL PORTAL — all school users (guarded by schoolAuthGuard)
      // ══════════════════════════════════════════════════════════════════════
      {
        path: 'school',
        component: SchoolLayout,
        canActivate: [schoolAuthGuard],
        children: [
          // ── Dashboard ────────────────────────────────────────────────────
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/school/dashboard/dashboard').then((m) => m.Dashboard),
            canActivate: [
              permissionGuard([
                'dashboard.view',
                'dashboard.student.view',
                'dashboard.parent.view',
              ]),
            ],
          },

          // ── My Profile (all roles) ────────────────────────────────────────
          {
            path: 'profile',
            children: [
              { path: '', redirectTo: 'me', pathMatch: 'full' },
              {
                path: 'me',
                loadComponent: () =>
                  import('./features/school/profile/my-profile/my-profile').then(
                    (m) => m.MyProfile
                  ),
                // No permissionGuard — every authenticated school user can view their own profile
              },
            ],
          },

          // ── About Us (viewer — all authenticated school users) ────────────
          {
            path: 'about-us',
            loadComponent: () =>
              import('./features/school/about-us/about-us-view/about-us-view').then(
                (m) => m.AboutUsView
              ),
          },

          // ── School Contact Info (viewer — all authenticated school users) ──
          {
            path: 'school-contact',
            loadComponent: () =>
              import('./features/school/school-contact-info/school-contact-info').then(
                (m) => m.SchoolContactInfo
              ),
          },

          // ── Contact Support (school staff → app developers) ───────────────
          {
            path: 'contact-us',
            loadComponent: () =>
              import('./features/school/contact-us/contact-us').then((m) => m.ContactUs),
            canActivate: [permissionGuard('contact.submit')],
          },

          // ── Notifications ─────────────────────────────────────────────────
          {
            path: 'notifications',
            loadChildren: () =>
              import('./features/school/notifications/notifications.routes').then(
                (m) => m.NOTIFICATIONS_ROUTES
              ),
          },

          // ── Users ─────────────────────────────────────────────────────────
          {
            path: 'users',
            loadChildren: () =>
              import('./features/school/users/users.routes').then((m) => m.USERS_ROUTES),
          },

          // ── Roles (Owner/Principal only) ──────────────────────────────────
          {
            path: 'roles',
            loadComponent: () => import('./features/school/roles/roles/roles').then((m) => m.Roles),
            canActivate: [permissionGuard('roles.manage')],
          },

          // ── Academics ─────────────────────────────────────────────────────
          {
            path: 'academics',
            loadChildren: () =>
              import('./features/school/academics/academics.routes').then(
                (m) => m.ACADEMICS_ROUTES
              ),
          },

          // ── Fees ──────────────────────────────────────────────────────────
          {
            path: 'fees',
            canActivate: [
              permissionGuard([
                'fees.report',
                'fees.payments.record',
                'fees.structures.manage',
                'fees.ledger.view',
                'fees.student.view',
                'fees.parent.view',
              ]),
            ],
            loadChildren: () =>
              import('./features/school/fees/fees.routes').then((m) => m.FEES_ROUTES),
          },

          // ── Attendance ────────────────────────────────────────────────────
          {
            path: 'attendance',
            loadChildren: () =>
              import('./features/school/attendance/attendance.routes').then(
                (m) => m.ATTENDANCE_ROUTES
              ),
          },

          // ── Assignments ───────────────────────────────────────────────────
          {
            path: 'assignments',
            loadChildren: () =>
              import('./features/school/assignments/assignments.routes').then(
                (m) => m.ASSIGNMENTS_ROUTES
              ),
          },

          // ── Exams ─────────────────────────────────────────────────────────
          {
            path: 'exams',
            loadChildren: () =>
              import('./features/school/exams/exams.routes').then((m) => m.EXAMS_ROUTES),
          },

          // ── Students ──────────────────────────────────────────────────────
          {
            path: 'students',
            loadChildren: () =>
              import('./features/school/students/students.routes').then((m) => m.STUDENTS_ROUTES),
          },

          // ── Parents ───────────────────────────────────────────────────────
          {
            path: 'parents',
            loadChildren: () =>
              import('./features/school/parents/parents.routes').then((m) => m.PARENTS_ROUTES),
          },

          // ── Settings ──────────────────────────────────────────────────────
          {
            path: 'settings',
            loadChildren: () =>
              import('./features/school/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
          },

          // ── ID Cards ──────────────────────────────────────────────────────
          {
            path: 'id-cards',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'manage' },
              {
                path: 'manage',
                canActivate: [permissionGuard('id-cards.view')],
                loadComponent: () =>
                  import('./features/school/id-cards/id-card-management/id-card-management').then(
                    (m) => m.IdCardManagementComponent
                  ),
              },
              {
                path: 'templates',
                canActivate: [permissionGuard('id-cards.templates.manage')],
                loadComponent: () =>
                  import('./features/school/id-cards/id-card-template-manage/id-card-template-manage').then(
                    (m) => m.IdCardTemplateManageComponent
                  ),
              },
            ],
          },

          // ── Feed ──────────────────────────────────────────────────────────
          {
            path: 'feed',
            loadChildren: () =>
              import('./features/school/feed/feed.routes').then((m) => m.FEED_ROUTES),
          },

          // ── Billing (access plans + WhatsApp bundles) ───────────────────────
          {
            path: 'billing',
            loadChildren: () =>
              import('./features/school/billing/billing.routes').then((m) => m.BILLING_ROUTES),
          },

          // ── WhatsApp (templates, single/bulk send, history, inbound) ──────────────
          {
            path: 'whatsapp',
            loadChildren: () =>
              import('./features/school/whatsapp/whatsapp.routes').then((m) => m.WHATSAPP_ROUTES),
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // SUPER ADMIN PORTAL
      // ══════════════════════════════════════════════════════════════════════
      {
        path: 'super',
        loadChildren: () => import('./features/super/super.routes').then((m) => m.SUPER_ROUTES),
      },

      // ── Utility ───────────────────────────────────────────────────────────
      { path: 'unauthorized', component: Unauthorized },
      { path: '**', component: PageNotFound },
    ],
  },
];
