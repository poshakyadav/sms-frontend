// features/school/fees/fees.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const FEES_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./fee-dashboard/fees-dashboard/fees-dashboard').then((m) => m.FeesDashboardComponent),
    canActivate: [permissionGuard('fees.report')],
  },
  {
    path: 'structures',
    loadComponent: () =>
      import('./structures/fee-structures-list/fee-structures-list').then(
        (m) => m.FeeStructuresList
      ),
    canActivate: [permissionGuard('fees.report')],
  },
  {
    path: 'report',
    loadComponent: () => import('./report/fee-report/fee-report').then((m) => m.FeeReport),
    canActivate: [permissionGuard('fees.report')],
  },
  // ── Staff: Per-student fee detail — assignments, concessions, payments ──────
  // Route:  /school/fees/student-detail
  // Access: navigate here from the fee report (click detail icon on a student
  //         row) or link directly with ?studentId=<id> for deep-linking.
  // Guard:  fees.report is sufficient — same staff who can see the report can
  //         manage individual student fees.
  {
    path: 'student-detail',
    loadComponent: () =>
      import('./student-fee-detail/student-fee-detail').then((m) => m.StudentFeeDetail),
    canActivate: [permissionGuard('fees.report')],
  },
  {
    path: 'ledger',
    loadComponent: () => import('./fee-ledger/fee-ledger').then((m) => m.FeeLedger),
    canActivate: [permissionGuard(['fees.report', 'fees.ledger.view'])],
  },
  {
    path: 'concessions',
    loadComponent: () =>
      import('./fee-concessions/concessions-dashboard/concessions-dashboard').then(
        (m) => m.ConcessionsDashboard
      ),
    canActivate: [permissionGuard('fees.report')],
  },
  {
    path: 'my',
    loadComponent: () =>
      import('../student-view/student-fees/student-fees').then((m) => m.StudentFees),
    canActivate: [permissionGuard('fees.student.view')],
  },
  {
    path: 'child',
    loadComponent: () => import('../parent-view/parent-fees/parent-fees').then((m) => m.ParentFees),
    canActivate: [permissionGuard('fees.parent.view')],
  },
];
