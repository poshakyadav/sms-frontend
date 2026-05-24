// features/school/assignments/assignments.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const ASSIGNMENTS_ROUTES: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },

  // ── Staff: Assignment list ────────────────────────────────────────────────
  {
    path: 'list',
    loadComponent: () =>
      import('./assignments-list-component/assignments-list-component').then(
        (m) => m.AssignmentsListComponent
      ),
    canActivate: [permissionGuard(['assignments.create'])],
  },

  // ── Staff: Create assignment ──────────────────────────────────────────────
  {
    path: 'new',
    loadComponent: () =>
      import('./assignments-form-component/assignments-form-component').then(
        (m) => m.AssignmentsFormComponent
      ),
    canActivate: [permissionGuard('assignments.create')],
  },

  // ── Staff: Edit assignment ────────────────────────────────────────────────
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./assignments-form-component/assignments-form-component').then(
        (m) => m.AssignmentsFormComponent
      ),
    canActivate: [permissionGuard('assignments.edit')],
  },

  // ── Staff: View & grade submissions ──────────────────────────────────────
  {
    path: 'submissions/:id',
    loadComponent: () =>
      import('./assignment-submissions-component/assignment-submissions-component').then(
        (m) => m.AssignmentSubmissionsComponent
      ),
    canActivate: [permissionGuard('assignments.grade')],
  },

  // ── Student: View own assignments ─────────────────────────────────────────
  {
    path: 'my',
    loadComponent: () =>
      import('../student-view/student-assignments/student-assignments').then(
        (m) => m.StudentAssignments
      ),
    canActivate: [permissionGuard('assignments.student.view')],
  },

  // ── Parent: View child's assignments ─────────────────────────────────────
  {
    path: 'child',
    loadComponent: () =>
      import('../parent-view/parent-assignments/parent-assignments').then(
        (m) => m.ParentAssignments
      ),
    canActivate: [permissionGuard('assignments.parent.view')],
  },
];
