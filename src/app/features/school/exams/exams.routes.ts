// features/school/exams/exams.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const EXAMS_ROUTES: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },

  // ── Staff: Exam list ──────────────────────────────────────────────────────
  {
    path: 'list',
    loadComponent: () => import('./exams-list/exams-list').then((m) => m.ExamsList),
    canActivate: [permissionGuard(['exams.create', 'exams.marks.enter'])],
  },

  // ── Staff: Create / edit exam ─────────────────────────────────────────────
  {
    path: 'new',
    loadComponent: () => import('./exams-form/exams-form').then((m) => m.ExamsForm),
    canActivate: [permissionGuard('exams.create')],
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./exams-form/exams-form').then((m) => m.ExamsForm),
    canActivate: [permissionGuard('exams.edit')],
  },

  // ── Staff: Marks entry ────────────────────────────────────────────────────
  {
    path: 'marks/:examId',
    loadComponent: () => import('./marks-entry/marks-entry').then((m) => m.MarksEntry),
    canActivate: [permissionGuard('exams.marks.enter')],
  },

  // ── Staff: Exam students card view (admit card + report card actions) ─────
  {
    path: 'cards/:examId',
    loadComponent: () =>
      import('./exam-students-card-view/exam-students-card-view').then(
        (m) => m.ExamStudentsCardView
      ),
    canActivate: [permissionGuard(['exams.admit-card', 'exams.report-card'])],
  },

  // ── Staff: Admit card & report card ──────────────────────────────────────
  {
    path: 'admit-card',
    loadComponent: () => import('./admit-card/admit-card').then((m) => m.AdmitCard),
    canActivate: [permissionGuard('exams.admit-card')],
  },
  {
    path: 'report-card',
    loadComponent: () => import('./report-card/report-card').then((m) => m.ReportCard),
    canActivate: [permissionGuard('exams.report-card')],
  },

  // ── Staff: Template manager ───────────────────────────────────────────────
  {
    path: 'templates',
    loadComponent: () =>
      import('./template-manager/template-manager').then((m) => m.TemplateManager),
    canActivate: [permissionGuard('exams.templates.manage')],
  },

  // ── Student: Exam hub — schedule, results, admit card, report card ────────
  {
    path: 'student/my',
    loadComponent: () =>
      import('../student-view/student-exams/student-exams').then((m) => m.StudentExams),
    canActivate: [permissionGuard('exams.student.view')],
  },
  {
    path: 'student/admit-card',
    loadComponent: () =>
      import('./student-admit-card/student-admit-card').then((m) => m.StudentAdmitCard),
    canActivate: [permissionGuard('exams.student.admit-card')],
  },
  {
    path: 'student/report-card',
    loadComponent: () =>
      import('./student-report-card/student-report-card').then((m) => m.StudentReportCard),
    canActivate: [permissionGuard('exams.student.report-card')],
  },

  // ── Parent: Exam hub — overview, schedule, results ────────────────────────
  // Active child resolved via X-Active-Child-Id header (auth-interceptor).
  {
    path: 'child',
    loadComponent: () =>
      import('../parent-view/parent-exams/parent-exams').then((m) => m.ParentExams),
    canActivate: [permissionGuard('exams.parent.view')],
  },
  {
    path: 'parent/admit-card',
    loadComponent: () =>
      import('./parent-admit-card/parent-admit-card').then((m) => m.ParentAdmitCard),
    canActivate: [permissionGuard('exams.parent.admit-card')],
  },
  {
    path: 'parent/report-card',
    loadComponent: () =>
      import('./parent-report-card/parent-report-card').then((m) => m.ParentReportCard),
    canActivate: [permissionGuard('exams.parent.report-card')],
  },
];
