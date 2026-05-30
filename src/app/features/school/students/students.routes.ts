// features/school/students/students.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const STUDENTS_ROUTES: Routes = [
  // ── Staff: Student list ───────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./students-list/students-list').then((m) => m.StudentsList),
    canActivate: [permissionGuard('students.list')],
  },

  // ── Student/Staff: Profile view ───────────────────────────────────────────
  {
    path: 'profile',
    loadComponent: () => import('./student-profile/student-profile').then((m) => m.StudentProfile),
    canActivate: [permissionGuard(['students.list', 'students.view.own'])],
  },

  // ── Staff: Bulk upload ────────────────────────────────────────────────────
  {
    path: 'bulk-upload',
    loadComponent: () =>
      import('./bulk-student-upload/bulk-student-upload').then((m) => m.BulkStudentUploadComponent),
    canActivate: [permissionGuard(['students.bulk-upload', 'academics.enroll'])],
  },

  // ── History: Student history list page ───────────────────────────────────
  {
    path: 'history',
    loadComponent: () =>
      import('./history/students-history-list/students-history-list').then(
        (m) => m.StudentsHistoryList
      ),
    canActivate: [permissionGuard('students.list')],
  },

  // ── History: Individual student full timeline ─────────────────────────────
  {
    path: 'history/:id',
    loadComponent: () =>
      import('./history/students-history-detail/students-history-detail').then(
        (m) => m.StudentsHistoryDetail
      ),
    canActivate: [permissionGuard('students.list')],
  },

  // ── UDISE: School-wide completeness dashboard ─────────────────────────────
  {
    path: 'udise',
    loadComponent: () =>
      import('./udise/udise-dashboard/udise-dashboard').then((m) => m.UdiseDashboard),
    canActivate: [permissionGuard('students.profile.manage')],
  },

  // ── UDISE: Individual student UDISE profile editor ────────────────────────
  {
    path: 'udise/:id',
    loadComponent: () =>
      import('./udise/udise-profile-editor/udise-profile-editor').then((m) => m.UdiseProfileEditor),
    canActivate: [permissionGuard('students.profile.manage')],
  },

  // ── Staff/Student: Detail by ID ───────────────────────────────────────────
  {
    path: ':id',
    loadComponent: () => import('./student-detail/student-detail').then((m) => m.StudentDetail),
    canActivate: [permissionGuard(['students.list', 'students.view.own'])],
  },
];
