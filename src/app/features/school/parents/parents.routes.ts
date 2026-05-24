// features/school/parents/parents.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const PARENTS_ROUTES: Routes = [
  { path: '', redirectTo: 'link', pathMatch: 'full' },

  // ── Staff: Parent–Student Link Management ─────────────────────────────────
  // Lets authorised staff search for a student and add/remove/promote parents,
  // or search for a parent and see all linked children.
  {
    path: 'link',
    loadComponent: () =>
      import('./parent-student-link/parent-student-link').then((m) => m.ParentStudentLink),
    canActivate: [permissionGuard('parents.manage')],
  },
];
