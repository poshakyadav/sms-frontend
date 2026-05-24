// features/school/academics/academics.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const ACADEMICS_ROUTES: Routes = [
  { path: '', redirectTo: 'years', pathMatch: 'full' },

  // ── Academic Years ─────────────────────────────────────────────────────────
  {
    path: 'years',
    loadComponent: () =>
      import('./academics-year/academics-year/academics-year').then((m) => m.AcademicsYear),
    canActivate: [permissionGuard('academics.years.manage')],
  },
  {
    path: 'years/new',
    loadComponent: () =>
      import('./academics-year/academics-year-form/academics-year-form').then(
        (m) => m.AcademicsYearForm
      ),
    canActivate: [permissionGuard('academics.years.manage')],
  },
  {
    path: 'years/edit/:id',
    loadComponent: () =>
      import('./academics-year/academics-year-form/academics-year-form').then(
        (m) => m.AcademicsYearForm
      ),
    canActivate: [permissionGuard('academics.years.manage')],
  },

  // ── Classes ────────────────────────────────────────────────────────────────
  // IMPORTANT: bulk-create and bulk-edit MUST appear BEFORE 'classes/new'
  // and 'classes/edit/:id' so the router matches them as literals rather
  // than treating "bulk-create" as the :id param.
  {
    path: 'classes',
    loadComponent: () => import('./classes/class-list/class-list').then((m) => m.ClassList),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    // ── Bulk create ──────────────────────────────────────────────────────
    path: 'classes/bulk-create',
    loadComponent: () =>
      import('./classes/class-bulk-create/class-bulk-create').then((m) => m.ClassBulkCreate),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    // ── Bulk edit ────────────────────────────────────────────────────────
    path: 'classes/bulk-edit',
    loadComponent: () =>
      import('./classes/class-bulk-edit/class-bulk-edit').then((m) => m.ClassBulkEdit),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    path: 'classes/new',
    loadComponent: () =>
      import('./classes/class-form-component/class-form-component').then(
        (m) => m.ClassFormComponent
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    path: 'classes/edit/:id',
    loadComponent: () =>
      import('./classes/class-form-component/class-form-component').then(
        (m) => m.ClassFormComponent
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },

  // ── Sections ───────────────────────────────────────────────────────────────
  {
    path: 'sections',
    loadComponent: () =>
      import('./sections/sections-list/sections-list').then((m) => m.SectionsList),
    canActivate: [permissionGuard('academics.sections.manage')],
  },
  {
    path: 'sections/new',
    loadComponent: () => import('./sections/section-form/section-form').then((m) => m.SectionForm),
    canActivate: [permissionGuard('academics.sections.manage')],
  },
  {
    path: 'sections/edit/:id',
    loadComponent: () => import('./sections/section-form/section-form').then((m) => m.SectionForm),
    canActivate: [permissionGuard('academics.sections.manage')],
  },

  // ── Class-Sections ─────────────────────────────────────────────────────────
  // IMPORTANT: bulk-create and bulk-edit MUST come BEFORE :id routes.
  {
    path: 'class-sections',
    loadComponent: () =>
      import('./class-sections/class-sections-list/class-sections-list').then(
        (m) => m.ClassSectionsList
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    // ── Bulk create ──────────────────────────────────────────────────────
    path: 'class-sections/bulk-create',
    loadComponent: () =>
      import('./class-sections/class-section-bulk-create/class-section-bulk-create').then(
        (m) => m.ClassSectionBulkCreate
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    // ── Bulk edit ────────────────────────────────────────────────────────
    path: 'class-sections/bulk-edit',
    loadComponent: () =>
      import('./class-sections/class-section-bulk-edit/class-section-bulk-edit').then(
        (m) => m.ClassSectionBulkEdit
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    path: 'class-sections/new',
    loadComponent: () =>
      import('./class-sections/class-section-form/class-section-form').then(
        (m) => m.ClassSectionForm
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },
  {
    path: 'class-sections/edit/:id',
    loadComponent: () =>
      import('./class-sections/class-section-form/class-section-form').then(
        (m) => m.ClassSectionForm
      ),
    canActivate: [permissionGuard('academics.classes.manage')],
  },

  // ── Mappings (Promotion) ───────────────────────────────────────────────────
  {
    path: 'mappings',
    loadComponent: () =>
      import('./mappings/mappings-list/mappings-list').then((m) => m.MappingsList),
    canActivate: [permissionGuard('academics.mappings.manage')],
  },
  {
    path: 'mappings/bulk',
    loadComponent: () =>
      import('./mappings/mappings-bulk/mappings-bulk').then((m) => m.MappingsBulk),
    canActivate: [permissionGuard('academics.mappings.manage')],
  },

  // ── Enrollment
  // Accessible by users with EITHER academics.enroll OR academics.unenroll.
  // The component itself enforces fine-grained permission per tab.
  {
    path: 'enroll',
    loadComponent: () =>
      import('./enrollment-management/enrollment-management/enrollment-management').then(
        (m) => m.EnrollmentManagement
      ),
    canActivate: [permissionGuard(['academics.enroll', 'academics.unenroll'])],
  },

  // ── Subjects ───────────────────────────────────────────────────────────────
  {
    path: 'subjects',
    children: [
      { path: '', redirectTo: 'list', pathMatch: 'full' },
      {
        path: 'list',
        loadComponent: () =>
          import('./subjects/subjects-list/subjects-list').then((m) => m.SubjectsList),
        canActivate: [permissionGuard('academics.subjects.manage')],
      },
      // ── Bulk create (MUST come before 'new' so router matches literal) ──────
      {
        path: 'bulk-create',
        loadComponent: () =>
          import('./subjects/subjects-bulk-create/subjects-bulk-create').then(
            (m) => m.SubjectsBulkCreate
          ),
        canActivate: [permissionGuard('academics.subjects.manage')],
      },
      // ── Bulk edit (MUST come before 'edit/:id') ───────────────────────────
      {
        path: 'bulk-edit',
        loadComponent: () =>
          import('./subjects/subjects-bulk-edit/subjects-bulk-edit').then((m) => m.SubjectsBulkEdit),
        canActivate: [permissionGuard('academics.subjects.manage')],
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./subjects/subjects-form/subjects-form').then((m) => m.SubjectsForm),
        canActivate: [permissionGuard('academics.subjects.manage')],
      },
      {
        path: 'edit/:id',
        loadComponent: () =>
          import('./subjects/subjects-form/subjects-form').then((m) => m.SubjectsForm),
        canActivate: [permissionGuard('academics.subjects.manage')],
      },
      {
        path: 'assign-class/:classId',
        loadComponent: () =>
          import('./subjects/assign-subjects-to-class/assign-subjects-to-class').then(
            (m) => m.AssignSubjectsToClassSection
          ),
        canActivate: [permissionGuard('academics.subjects.manage')],
      },
      {
        path: 'assign-teacher/:classSubjectId',
        loadComponent: () =>
          import(
            './subjects/assign-teacher-to-class-section-subject/assign-teacher-to-class-section-subject'
          ).then((m) => m.AssignTeacherToClassSectionSubject),
        canActivate: [permissionGuard('academics.assign-teacher')],
      },
    ],
  },
];
