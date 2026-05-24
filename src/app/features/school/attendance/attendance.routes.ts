// features/school/attendance/attendance.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const ATTENDANCE_ROUTES: Routes = [
  { path: '', redirectTo: 'mark', pathMatch: 'full' },

  // ── Staff: Mark attendance ─────────────────────────────────────────────────
  {
    path: 'mark',
    loadComponent: () =>
      import('./attendance-component/attendance-component').then((m) => m.AttendanceComponent),
    canActivate: [permissionGuard('attendance.mark')],
  },

  // ── Staff: View a specific student's attendance record ─────────────────────
  {
    path: 'student/:studentId',
    loadComponent: () =>
      import('./student-attendance-component/student-attendance-component').then(
        (m) => m.StudentAttendanceComponent
      ),
    canActivate: [permissionGuard('attendance.mark')],
  },

  // ── Staff: Class-wide attendance report ───────────────────────────────────
  {
    path: 'report',
    loadComponent: () =>
      import('./attendance-report-component/attendance-report-component').then(
        (m) => m.AttendanceReportComponent
      ),
    canActivate: [permissionGuard('attendance.report')],
  },

  // ── Student: View own attendance ──────────────────────────────────────────
  // The component calls GET /school/attendance/me — userId comes from JWT.
  {
    path: 'my',
    loadComponent: () =>
      import('../student-view/student-attendance-component/student-attendance-component').then(
        (m) => m.StudentAttendanceComponent
      ),
    canActivate: [permissionGuard('attendance.student.view')],
  },

  // ── Parent: View child's attendance ───────────────────────────────────────
  // The component calls GET /school/attendance/child — childId from
  // X-Active-Child-Id header (set by auth-interceptor from ParentService).
  {
    path: 'child',
    loadComponent: () =>
      import('../parent-view/parent-attendance-component/parent-attendance-component').then(
        (m) => m.ParentAttendanceComponent
      ),
    canActivate: [permissionGuard('attendance.parent.view')],
  },
];
