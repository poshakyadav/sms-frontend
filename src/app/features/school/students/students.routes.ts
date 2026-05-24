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

  // ── Staff/Student: Detail by ID ───────────────────────────────────────────
  {
    path: ':id',
    loadComponent: () => import('./student-detail/student-detail').then((m) => m.StudentDetail),
    canActivate: [permissionGuard(['students.list', 'students.view.own'])],
  },
];
