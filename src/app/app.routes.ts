// app.routes.ts

import { Routes } from '@angular/router';
import { authReadyGuard } from './core/guards/auth-ready-guard';
import {
  loginGuard,
  permissionGuard,
  schoolAuthGuard,
  superAuthGuard,
  superPermissionGuard,
} from './core/guards/permission-guard';
import { setupPageGuard } from './core/guards/super-setup-guard';
import { PageNotFound } from './shared/components/page-not-found/page-not-found';
import { Unauthorized } from './shared/components/unauthorized/unauthorized';
import { SchoolLayout } from './shared/layouts/school-layout/school-layout';
import { SuperLayout } from './shared/layouts/super-layout/super-layout';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authReadyGuard],
    children: [
      // ── Root redirect ──────────────────────────────────────────────────────────
      { path: '', redirectTo: '/login', pathMatch: 'full' },

      // ══════════════════════════════════════════════════════════════════════════
      // SCHOOL LOGIN FLOW
      // ══════════════════════════════════════════════════════════════════════════
      {
        path: 'login',
        canActivate: [loginGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/login/school-code-entry/school-code-entry').then(
                (m) => m.SchoolCodeEntry
              ),
          },
          {
            path: 'credentials',
            loadComponent: () =>
              import(
                './features/school/school-login/school-login-credentials/school-login-credentials'
              ).then((m) => m.SchoolLoginCredentials),
          },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════════
      // SUPER ADMIN LOGIN  (separate URL, separate guard)
      // ══════════════════════════════════════════════════════════════════════════
      {
        path: 'super/login',
        canActivate: [loginGuard],
        loadComponent: () =>
          import('./features/super/super-login/super-login').then((m) => m.SuperLogin),
      },

      // ===== super admin set-up route =====
      {
        path: 'super/setup',
        loadComponent: () =>
          import('./features/super/super-setup/super-setup/super-setup').then((m) => m.SuperSetup),
        canActivate: [setupPageGuard],
      },

      // ══════════════════════════════════════════════════════════════════════════
      // PUBLIC INFORMATIONAL PAGES (no auth required)
      // ══════════════════════════════════════════════════════════════════════════

      // ── About Us ──────────────────────────────────────────────────────────────────
      {
        path: 'public/about',
        loadComponent: () => import('./features/public/about-us/about-us').then((m) => m.AboutUs),
      },

      // ── Terms & Conditions ────────────────────────────────────────────────────────
      {
        path: 'public/terms',
        loadComponent: () =>
          import('./features/public/terms-and-conditions/terms-and-conditions').then(
            (m) => m.TermsAndConditions
          ),
      },

      // ── Privacy Policy ────────────────────────────────────────────────────────────
      {
        path: 'public/privacy',
        loadComponent: () =>
          import('./features/public/privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
      },

      // ── Security Policy ───────────────────────────────────────────────────────────
      {
        path: 'public/security',
        loadComponent: () =>
          import('./features/public/security-policy/security-policy').then((m) => m.SecurityPolicy),
      },

      // ── Optional: add short redirects for convenience ────────────────────────────
      // { path: 'about', redirectTo: 'public/about', pathMatch: 'full' },
      // { path: 'privacy', redirectTo: 'public/privacy', pathMatch: 'full' },
      // { path: 'terms', redirectTo: 'public/terms', pathMatch: 'full' },
      // { path: 'security', redirectTo: 'public/security', pathMatch: 'full' },

      // ══════════════════════════════════════════════════════════════════════════
      // PUBLIC ROUTES (no auth required)
      // ══════════════════════════════════════════════════════════════════════════

      // Public school registration interest form (new schools, no invite needed)
      {
        path: 'public/register',
        loadComponent: () =>
          import('./features/public/school-registration/school-registration').then(
            (m) => m.SchoolRegistration
          ),
      },

      // ══════════════════════════════════════════════════════════════════════════
      // PUBLIC SCHOOL ONBOARDING FLOW (no auth required) (invite-token based — existing flow)
      // ══════════════════════════════════════════════════════════════════════════
      {
        path: 'school/register',
        loadComponent: () =>
          import('./features/school/school-sign-up/school-sign-up').then((m) => m.SchoolSignUp),
      },
      {
        path: 'school/payment',
        loadComponent: () =>
          import('./features/school/school-payment/school-payment/school-payment').then(
            (m) => m.SchoolPayment
          ),
      },

      // ══════════════════════════════════════════════════════════════════════════
      // SCHOOL PORTAL  (all school users — guarded by schoolAuthGuard at layout)
      // ══════════════════════════════════════════════════════════════════════════
      {
        path: 'school',
        component: SchoolLayout,
        canActivate: [schoolAuthGuard], // ← ensures only school users, any permission
        children: [
          // DASHBOARD — every role gets this
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

          // ── MY PROFILE (universal — all roles) ────────────────────────────────
          // Route: /school/profile/me
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
                // No permission guard — every authenticated school user can view their own profile
              },
            ],
          },

          // ── ABOUT US (all authenticated school users — viewer) ─────────────────────
          {
            path: 'about-us',
            loadComponent: () =>
              import('./features/school/about-us/about-us-view/about-us-view').then(
                (m) => m.AboutUsView
              ),
            // No permissionGuard — every authenticated school user can view
          },

          // ── CONTACT INFO (all authenticated school users — viewer) ─────────────────────
          {
            path: 'school-contact',
            loadComponent: () =>
              import('./features/school/school-contact-info/school-contact-info').then(
                (m) => m.SchoolContactInfo
              ),
            // No permissionGuard — accessible to all authenticated school users.
          },

          // ── CONTACT SUPPORT (On for school staff contact to devlopers of this app)) ──────────────────
          {
            path: 'contact-us',
            loadComponent: () =>
              import('./features/school/contact-us/contact-us').then((m) => m.ContactUs),
            canActivate: [permissionGuard('contact.submit')],
          },

          // ==================== NOTIFICATIONS MODULE (NEW) ====================
          // ── NOTIFICATIONS ────────────────────────────────────────────────────
          {
            path: 'notifications',
            children: [
              { path: '', redirectTo: 'list', pathMatch: 'full' },
              {
                path: 'list',
                loadComponent: () =>
                  import(
                    './features/school/notifications/notifications-list/notifications-list'
                  ).then((m) => m.NotificationsList),
                canActivate: [
                  permissionGuard([
                    'notifications.view',
                    'notifications.student.view',
                    'notifications.parent.view',
                  ]),
                ],
              },
              {
                path: 'new',
                loadComponent: () =>
                  import(
                    './features/school/notifications/notifications-create/notifications-create'
                  ).then((m) => m.NotificationsCreate),
                canActivate: [permissionGuard('notifications.send')],
              },
              {
                path: 'report/:id',
                loadComponent: () =>
                  import(
                    './features/school/notifications/notifications-report/notifications-report'
                  ).then((m) => m.NotificationsReport),
                canActivate: [permissionGuard('notifications.send')],
              },
            ],
          },

          // ── USERS ────────────────────────────────────────────────────────────
          {
            path: 'users',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/school/users/users-list/users-list').then((m) => m.UsersList),
                canActivate: [permissionGuard('users.list')],
              },
              // ── NEW: Role-based creation hub (replaces the old 'new' route) ────────
              {
                path: 'create',
                loadComponent: () =>
                  import('./features/school/users/user-creation-hub/user-creation-hub').then(
                    (m) => m.UserCreationHub
                  ),
                canActivate: [permissionGuard('users.create')],
              },
              {
                path: 'edit/:id',
                loadComponent: () =>
                  import('./features/school/users/user-form/user-form').then((m) => m.UserForm),
                canActivate: [permissionGuard('users.edit')],
              },
            ],
          },

          // ── ROLES (Owner/Principal only) ─────────────────────────────────────
          {
            path: 'roles',
            loadComponent: () => import('./features/school/roles/roles/roles').then((m) => m.Roles),
            canActivate: [permissionGuard('roles.manage')],
          },

          // ── ACADEMICS ────────────────────────────────────────────────────────
          {
            path: 'academics',
            children: [
              { path: '', redirectTo: 'years', pathMatch: 'full' },

              // Academic Years
              {
                path: 'years',
                loadComponent: () =>
                  import(
                    './features/school/academics/academics-year/academics-year/academics-year'
                  ).then((m) => m.AcademicsYear),
                canActivate: [permissionGuard('academics.years.manage')],
              },
              {
                path: 'years/new',
                loadComponent: () =>
                  import(
                    './features/school/academics/academics-year/academics-year-form/academics-year-form'
                  ).then((m) => m.AcademicsYearForm),
                canActivate: [permissionGuard('academics.years.manage')],
              },
              {
                path: 'years/edit/:id',
                loadComponent: () =>
                  import(
                    './features/school/academics/academics-year/academics-year-form/academics-year-form'
                  ).then((m) => m.AcademicsYearForm),
                canActivate: [permissionGuard('academics.years.manage')],
              },

              // Classes
              {
                path: 'classes',
                loadComponent: () =>
                  import('./features/school/academics/classes/class-list/class-list').then(
                    (m) => m.ClassList
                  ),
                canActivate: [permissionGuard('academics.classes.manage')],
              },
              {
                path: 'classes/new',
                loadComponent: () =>
                  import(
                    './features/school/academics/classes/class-form-component/class-form-component'
                  ).then((m) => m.ClassFormComponent),
                canActivate: [permissionGuard('academics.classes.manage')],
              },
              {
                path: 'classes/edit/:id',
                loadComponent: () =>
                  import(
                    './features/school/academics/classes/class-form-component/class-form-component'
                  ).then((m) => m.ClassFormComponent),
                canActivate: [permissionGuard('academics.classes.manage')],
              },

              // Sections
              {
                path: 'sections',
                loadComponent: () =>
                  import('./features/school/academics/sections/sections-list/sections-list').then(
                    (m) => m.SectionsList
                  ),
                canActivate: [permissionGuard('academics.sections.manage')],
              },
              {
                path: 'sections/new',
                loadComponent: () =>
                  import('./features/school/academics/sections/section-form/section-form').then(
                    (m) => m.SectionForm
                  ),
                canActivate: [permissionGuard('academics.sections.manage')],
              },
              {
                path: 'sections/edit/:id',
                loadComponent: () =>
                  import('./features/school/academics/sections/section-form/section-form').then(
                    (m) => m.SectionForm
                  ),
                canActivate: [permissionGuard('academics.sections.manage')],
              },

              // Class-Sections
              {
                path: 'class-sections',
                loadComponent: () =>
                  import(
                    './features/school/academics/class-sections/class-sections-list/class-sections-list'
                  ).then((m) => m.ClassSectionsList),
                canActivate: [permissionGuard('academics.classes.manage')],
              },
              {
                path: 'class-sections/new',
                loadComponent: () =>
                  import(
                    './features/school/academics/class-sections/class-section-form/class-section-form'
                  ).then((m) => m.ClassSectionForm),
                canActivate: [permissionGuard('academics.classes.manage')],
              },

              {
                path: 'class-sections/edit/:id',
                loadComponent: () =>
                  import(
                    './features/school/academics/class-sections/class-section-form/class-section-form'
                  ).then((m) => m.ClassSectionForm),
                canActivate: [permissionGuard('academics.classes.manage')],
              },

              // Mappings (Promotion)
              {
                path: 'mappings',
                loadComponent: () =>
                  import('./features/school/academics/mappings/mappings-list/mappings-list').then(
                    (m) => m.MappingsList
                  ),
                canActivate: [permissionGuard('academics.mappings.manage')],
              },
              {
                path: 'mappings/bulk',
                loadComponent: () =>
                  import('./features/school/academics/mappings/mappings-bulk/mappings-bulk').then(
                    (m) => m.MappingsBulk
                  ),
                canActivate: [permissionGuard('academics.mappings.manage')],
              },

              // Enroll

              // Route: /school/academics/enroll
              // Accessible by users with EITHER academics.enroll OR academics.unenroll permission.
              // The component itself enforces fine-grained permission per tab.
              {
                path: 'enroll',
                loadComponent: () =>
                  import(
                    './features/school/academics/enrollment-management/enrollment-management/enrollment-management'
                  ).then((m) => m.EnrollmentManagement),
                canActivate: [permissionGuard(['academics.enroll', 'academics.unenroll'])],
              },

              // Subjects
              {
                path: 'subjects',
                children: [
                  { path: '', redirectTo: 'list', pathMatch: 'full' },
                  {
                    path: 'list',
                    loadComponent: () =>
                      import(
                        './features/school/academics/subjects/subjects-list/subjects-list'
                      ).then((m) => m.SubjectsList),
                    canActivate: [permissionGuard('academics.subjects.manage')],
                  },
                  {
                    path: 'new',
                    loadComponent: () =>
                      import(
                        './features/school/academics/subjects/subjects-form/subjects-form'
                      ).then((m) => m.SubjectsForm),
                    canActivate: [permissionGuard('academics.subjects.manage')],
                  },
                  {
                    path: 'edit/:id',
                    loadComponent: () =>
                      import(
                        './features/school/academics/subjects/subjects-form/subjects-form'
                      ).then((m) => m.SubjectsForm),
                    canActivate: [permissionGuard('academics.subjects.manage')],
                  },
                  {
                    path: 'assign-class/:classId',
                    loadComponent: () =>
                      import(
                        './features/school/academics/subjects/assign-subjects-to-class/assign-subjects-to-class'
                      ).then((m) => m.AssignSubjectsToClassSection),
                    canActivate: [permissionGuard('academics.subjects.manage')],
                  },
                  {
                    path: 'assign-teacher/:classSubjectId',
                    loadComponent: () =>
                      import(
                        './features/school/academics/subjects/assign-teacher-to-class-section-subject/assign-teacher-to-class-section-subject'
                      ).then((m) => m.AssignTeacherToClassSectionSubject),
                    canActivate: [permissionGuard('academics.assign-teacher')],
                  },
                ],
              },
            ],
          },

          // ── FEES ─────────────────────────────────────────────────────────────
          {
            path: 'fees',
            children: [
              { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
              {
                path: 'dashboard',
                loadComponent: () =>
                  import('./features/school/fees/fee-dashboard/fee-dashboard/fee-dashboard').then(
                    (m) => m.FeeDashboard
                  ),
                canActivate: [permissionGuard('fees.report')],
              },
              {
                path: 'structures',
                loadComponent: () =>
                  import('./features/school/fees/structures/fee-structures/fee-structures').then(
                    (m) => m.FeeStructures
                  ),
                canActivate: [permissionGuard('fees.structures.manage')],
              },
              {
                path: 'structures/new',
                loadComponent: () =>
                  import(
                    './features/school/fees/structures/fee-structure-form/fee-structure-form'
                  ).then((m) => m.FeeStructureForm),
                canActivate: [permissionGuard('fees.structures.manage')],
              },
              {
                path: 'structures/edit/:id',
                loadComponent: () =>
                  import(
                    './features/school/fees/structures/fee-structure-form/fee-structure-form'
                  ).then((m) => m.FeeStructureForm),
                canActivate: [permissionGuard('fees.structures.manage')],
              },
              {
                path: 'payments/record',
                loadComponent: () =>
                  import('./features/school/fees/payments/record-payment/record-payment').then(
                    (m) => m.RecordPayment
                  ),
                canActivate: [permissionGuard('fees.payments.record')],
              },
              {
                path: 'payments-history/:enrollmentId',
                loadComponent: () =>
                  import('./features/school/fees/payments/payments-history/payments-history').then(
                    (m) => m.PaymentsHistory
                  ),
                canActivate: [permissionGuard('fees.report')],
              },
              {
                path: 'ledger/:studentId',
                loadComponent: () =>
                  import('./features/school/fees/ledger/student-ledger/student-ledger').then(
                    (m) => m.StudentLedgerComponent
                  ),
                canActivate: [permissionGuard('fees.ledger.view')],
              },
              {
                path: 'report',
                loadComponent: () =>
                  import('./features/school/fees/report/fee-report/fee-report').then(
                    (m) => m.FeeReport
                  ),
                canActivate: [permissionGuard('fees.report')],
              },
              // ── STUDENT: View own fees ──────────────────────────────────────────────
              // Route: /school/fees/student/my
              // Add inside the 'fees' children array (after existing fees routes):

              {
                path: 'student/my',
                loadComponent: () =>
                  import('./features/school/student-view/student-fees/student-fees').then(
                    (m) => m.StudentFees
                  ),
                canActivate: [permissionGuard('fees.student.view')],
              },

              // ── PARENT: View child's fees ───────────────────────────────────────────
              // Route: /school/fees/child
              // Add inside the 'fees' children array (after the student route above):

              {
                path: 'child',
                loadComponent: () =>
                  import('./features/school/parent-view/parent-fees/parent-fees').then(
                    (m) => m.ParentFees
                  ),
                canActivate: [permissionGuard('fees.parent.view')],
              },
            ],
          },

          // ── ATTENDANCE ───────────────────────────────────────────────────────
          {
            path: 'attendance',
            children: [
              { path: '', redirectTo: 'mark', pathMatch: 'full' },
              {
                path: 'mark',
                loadComponent: () =>
                  import(
                    './features/school/attendance/attendance-component/attendance-component'
                  ).then((m) => m.AttendanceComponent),
                canActivate: [permissionGuard('attendance.mark')],
              },
              // ── STAFF: View a specific student's attendance (staff use) ───────
              // Route: /school/attendance/student/:studentId
              // Used by teachers/admin to inspect any student's attendance record.
              // Guard: attendance.student.view (staff permission slug)
              {
                path: 'student/:studentId',
                loadComponent: () =>
                  import(
                    './features/school/attendance/student-attendance-component/student-attendance-component'
                  ).then((m) => m.StudentAttendanceComponent),
                canActivate: [permissionGuard('attendance.mark')],
              },
              // ── STAFF: Class-wide attendance report ───────────────────────────
              {
                path: 'report',
                loadComponent: () =>
                  import(
                    './features/school/attendance/attendance-report-component/attendance-report-component'
                  ).then((m) => m.AttendanceReportComponent),
                canActivate: [permissionGuard('attendance.report')],
              },

              // ── STUDENT: View own attendance ──────────────────────────────────
              // Route: /school/attendance/my
              // The component calls GET /school/attendance/me — userId comes from JWT.
              // Guard: attendance.student.view (student permission slug)
              {
                path: 'my',
                loadComponent: () =>
                  import(
                    './features/school/student-view/student-attendance-component/student-attendance-component'
                  ).then((m) => m.StudentAttendanceComponent),
                canActivate: [permissionGuard('attendance.student.view')],
              },

              // ── PARENT: View child's attendance ──────────────────────────────
              // Route: /school/attendance/child
              // The component calls GET /school/attendance/child — childId from
              // X-Active-Child-Id header (set by auth-interceptor from ParentService).
              // Guard: attendance.parent.view (parent permission slug)
              {
                path: 'child',
                loadComponent: () =>
                  import(
                    './features/school/parent-view/parent-attendance-component/parent-attendance-component'
                  ).then((m) => m.ParentAttendanceComponent),
                canActivate: [permissionGuard('attendance.parent.view')],
              },
            ],
          },

          // ── ASSIGNMENTS ──────────────────────────────────────────────────────
          {
            path: 'assignments',
            children: [
              { path: '', redirectTo: 'list', pathMatch: 'full' },
              {
                path: 'list',
                loadComponent: () =>
                  import(
                    './features/school/assignments/assignments-list-component/assignments-list-component'
                  ).then((m) => m.AssignmentsListComponent),
                canActivate: [
                  permissionGuard([
                    'assignments.create',
                    // 'assignments.student.view',
                    // 'assignments.parent.view',
                  ]),
                  // AFTER:
                  //   canActivate: [permissionGuard(['assignments.create', 'assignments.student.view', 'assignments.parent.view'])],
                  // (or leave the dedicated /my and /child routes as the entry points for students/parents)
                ],
              },
              {
                path: 'new',
                loadComponent: () =>
                  import(
                    './features/school/assignments/assignments-form-component/assignments-form-component'
                  ).then((m) => m.AssignmentsFormComponent),
                canActivate: [permissionGuard('assignments.create')],
              },
              {
                path: 'edit/:id',
                loadComponent: () =>
                  import(
                    './features/school/assignments/assignments-form-component/assignments-form-component'
                  ).then((m) => m.AssignmentsFormComponent),
                canActivate: [permissionGuard('assignments.edit')],
              },
              {
                path: 'submissions/:id',
                loadComponent: () =>
                  import(
                    './features/school/assignments/assignment-submissions-component/assignment-submissions-component'
                  ).then((m) => m.AssignmentSubmissionsComponent),
                canActivate: [permissionGuard('assignments.grade')],
              },

              // ── STUDENT: View own assignments (student portal) ─────────────────────────
              // Route: /school/assignments/my
              // Component: StudentAssignments (NEW dedicated component)
              {
                path: 'my',
                loadComponent: () =>
                  import(
                    './features/school/student-view/student-assignments/student-assignments'
                  ).then((m) => m.StudentAssignments),
                canActivate: [permissionGuard('assignments.student.view')],
              },

              // ── PARENT: View child's assignments (parent portal) ──────────────────────
              // Route: /school/assignments/child
              // Component: ParentAssignments (NEW dedicated component)
              {
                path: 'child',
                loadComponent: () =>
                  import(
                    './features/school/parent-view/parent-assignments/parent-assignments'
                  ).then((m) => m.ParentAssignments),
                canActivate: [permissionGuard('assignments.parent.view')],
              },
            ],
          },

          // ── EXAMS ────────────────────────────────────────────────────────────
          {
            path: 'exams',
            children: [
              { path: '', redirectTo: 'list', pathMatch: 'full' },
              {
                path: 'list',
                loadComponent: () =>
                  import('./features/school/exams/exams-list/exams-list').then((m) => m.ExamsList),
                canActivate: [permissionGuard(['exams.create', 'exams.marks.enter'])],
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./features/school/exams/exams-form/exams-form').then((m) => m.ExamsForm),
                canActivate: [permissionGuard('exams.create')],
              },
              {
                path: 'edit/:id',
                loadComponent: () =>
                  import('./features/school/exams/exams-form/exams-form').then((m) => m.ExamsForm),
                canActivate: [permissionGuard('exams.edit')],
              },
              {
                path: 'marks/:examId',
                loadComponent: () =>
                  import('./features/school/exams/marks-entry/marks-entry').then(
                    (m) => m.MarksEntry
                  ),
                canActivate: [permissionGuard('exams.marks.enter')],
              },

              // ── Staff: Exam Students Card View (NEW) ────────────────────────────────────
              // Route: /school/exams/cards/:examId
              // Shows all enrolled students for an exam's class-section with
              // Admit Card and Report Card action buttons.
              // Guard: exams.admit-card OR exams.report-card (either permission is sufficient)
              {
                path: 'cards/:examId',
                loadComponent: () =>
                  import(
                    './features/school/exams/exam-students-card-view/exam-students-card-view'
                  ).then((m) => m.ExamStudentsCardView),
                canActivate: [permissionGuard(['exams.admit-card', 'exams.report-card'])],
              },
              // ── Staff: admit card & report card ────────────────────────────────
              {
                path: 'admit-card',
                loadComponent: () =>
                  import('./features/school/exams/admit-card/admit-card').then((m) => m.AdmitCard),
                canActivate: [permissionGuard('exams.admit-card')],
              },
              {
                path: 'report-card',
                loadComponent: () =>
                  import('./features/school/exams/report-card/report-card').then(
                    (m) => m.ReportCard
                  ),
                canActivate: [permissionGuard('exams.report-card')],
              },
              // ── Staff: template manager ─────────────────────────────────────────
              {
                path: 'templates',
                loadComponent: () =>
                  import('./features/school/exams/template-manager/template-manager').then(
                    (m) => m.TemplateManager
                  ),
                canActivate: [permissionGuard('exams.templates.manage')],
              },
              // ── Student: exam hub ───────────────────────────────────────────────
              // ── STUDENT: View own exams & results ─────────────────────────────
              // Route: /school/exams/student/my
              // Component: StudentExams — schedule, results, admit card, report card
              // Guard: exams.student.view (student-specific permission slug)
              {
                path: 'student/my',
                loadComponent: () =>
                  import('./features/school/student-view/student-exams/student-exams').then(
                    (m) => m.StudentExams
                  ),
                canActivate: [permissionGuard('exams.student.view')],
              },

              // ── Student: admit card (NEW) ───────────────────────────────────────
              // Route: /school/exams/student/admit-card?examId=<id>
              // Called by StudentExams.viewAdmitCard()
              {
                path: 'student/admit-card',
                loadComponent: () =>
                  import('./features/school/exams/student-admit-card/student-admit-card').then(
                    (m) => m.StudentAdmitCard
                  ),
                canActivate: [permissionGuard('exams.student.admit-card')],
              },

              // ── Student: report card (NEW) ──────────────────────────────────────
              // Route: /school/exams/student/report-card?examId=<id>
              // Called by StudentExams.viewReportCard()
              {
                path: 'student/report-card',
                loadComponent: () =>
                  import('./features/school/exams/student-report-card/student-report-card').then(
                    (m) => m.StudentReportCard
                  ),
                canActivate: [permissionGuard('exams.student.report-card')],
              },

              // ── Parent: exam hub ────────────────────────────────────────────────
              // ── PARENT: View child's exams & results ──────────────────────────
              // Route: /school/exams/child
              // Component: ParentExams — overview, schedule (timeline), results
              // Guard: exams.parent.view (parent-specific permission slug)
              // The active child is resolved via X-Active-Child-Id header (auth-interceptor).
              {
                path: 'child',
                loadComponent: () =>
                  import('./features/school/parent-view/parent-exams/parent-exams').then(
                    (m) => m.ParentExams
                  ),
                canActivate: [permissionGuard('exams.parent.view')],
              },
              // ── Parent: admit card (NEW) ────────────────────────────────────────
              // Route: /school/exams/parent/admit-card?examId=<id>
              // Called by ParentExams.viewAdmitCard()
              {
                path: 'parent/admit-card',
                loadComponent: () =>
                  import('./features/school/exams/parent-admit-card/parent-admit-card').then(
                    (m) => m.ParentAdmitCard
                  ),
                canActivate: [permissionGuard('exams.parent.admit-card')],
              },

              // ── Parent: report card (NEW) ───────────────────────────────────────
              // Route: /school/exams/parent/report-card?examId=<id>
              // Called by ParentExams.viewReportCard()
              {
                path: 'parent/report-card',
                loadComponent: () =>
                  import('./features/school/exams/parent-report-card/parent-report-card').then(
                    (m) => m.ParentReportCard
                  ),
                canActivate: [permissionGuard('exams.parent.report-card')],
              },
            ],
          },

          // ── STUDENTS ─────────────────────────────────────────────────────────
          {
            path: 'students',
            children: [
              // List — staff with students.list permission
              {
                path: '',
                loadComponent: () =>
                  import('./features/school/students/students-list/students-list').then(
                    (m) => m.StudentsList
                  ),
                canActivate: [permissionGuard('students.list')],
              },
              // Own profile — for students with students.view.own permission
              {
                path: 'profile',
                loadComponent: () =>
                  import('./features/school/students/student-profile/student-profile').then(
                    (m) => m.StudentProfile
                  ),
                canActivate: [permissionGuard(['students.list', 'students.view.own'])],
              },
              {
                path: 'bulk-upload',
                loadComponent: () =>
                  import('./features/school/students/bulk-student-upload/bulk-student-upload').then(
                    (m) => m.BulkStudentUploadComponent
                  ),
                canActivate: [permissionGuard(['students.bulk-upload', 'academics.enroll'])],
              },
              // Detail by ID — staff OR student viewing own
              {
                path: ':id',
                loadComponent: () =>
                  import('./features/school/students/student-detail/student-detail').then(
                    (m) => m.StudentDetail
                  ),
                canActivate: [permissionGuard(['students.list', 'students.view.own'])],
              },
            ],
          },

          // ── PARENTS MODULE ────────────────────────────────────────────────────────────
          {
            path: 'parents',
            children: [
              { path: '', redirectTo: 'link', pathMatch: 'full' },

              // ── Parent–Student Link Management ────────────────────────────────────────
              // Route: /school/parents/link
              // Guard: parents.manage — only staff with parent management permission.
              // This page lets authorised staff:
              //   1. Search for a student and add/remove/promote parents via StudentParentsManager.
              //   2. Search for a parent and see all linked children.
              {
                path: 'link',
                loadComponent: () =>
                  import('./features/school/parents/parent-student-link/parent-student-link').then(
                    (m) => m.ParentStudentLink
                  ),
                canActivate: [permissionGuard('parents.manage')],
              },
            ],
          },

          // ── SETTINGS ───────────────────────────────────────────────────────────
          // Settings is an owner-only section with multiple sub-pages
          {
            path: 'settings',
            children: [
              // { path: '', redirectTo: 'theme', pathMatch: 'full' },

              // ── NEW: Settings hub (landing page — shows all available options) ────────
              // Route: /school/settings
              // Accessible by every authenticated school user.
              // The hub component filters cards by permission internally.
              {
                path: '',
                loadComponent: () =>
                  import('./features/school/settings/school-settings-hub/school-settings-hub').then(
                    (m) => m.SchoolSettingsHub
                  ),
                // No permissionGuard — hub is always reachable; cards inside are filtered.
              },

              // Theme settings — existing
              {
                path: 'theme',
                loadComponent: () =>
                  import(
                    './features/school/settings/theme-settings/theme-settings/theme-settings'
                  ).then((m) => m.ThemeSettings),
                canActivate: [permissionGuard('settings.manage')],
              },

              // School info / profile — NEW
              // Route: /school/settings/info
              {
                path: 'info',
                loadComponent: () =>
                  import('./features/school/settings/school-info/school-info/school-info').then(
                    (m) => m.SchoolInfoComponent
                  ),
                canActivate: [permissionGuard('settings.manage')],
              },

              {
                path: 'about-us',
                loadComponent: () =>
                  import('./features/school/settings/about-us-editor/about-us-editor').then(
                    (m) => m.AboutUsEditor
                  ),
                canActivate: [permissionGuard('settings.manage')],
              },
            ],
          },

          // Add more school-specific routes here, all protected by authGuard and roleGuard
        ],
      },

      // ══════════════════════════════════════════════════════════════════════════
      // SUPER ADMIN PORTAL
      // ══════════════════════════════════════════════════════════════════════════
      {
        path: 'super',
        component: SuperLayout,
        canActivate: [superAuthGuard],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/super/dashboard/dashboard').then((m) => m.Dashboard),
            canActivate: [superPermissionGuard('dashboard.view')],
          },
          {
            path: 'users',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/super/users/users/users').then((m) => m.Users),
                canActivate: [superPermissionGuard('users.list')],
              },
              {
                path: 'create',
                loadComponent: () =>
                  import('./features/super/users/user-create/user-create').then(
                    (m) => m.UserCreate
                  ),
                canActivate: [superPermissionGuard('users.create')],
              },
              {
                path: 'edit/:id',
                loadComponent: () =>
                  import('./features/super/users/user-edit/user-edit').then((m) => m.UserEdit),
                canActivate: [superPermissionGuard('users.list')], // list is enough to view; edit/roles/perms gated inside
              },
            ],
          },
          {
            path: 'roles',
            loadComponent: () => import('./features/super/roles/roles').then((m) => m.Roles),
            canActivate: [superPermissionGuard('roles.manage')],
          },
          {
            path: 'schools',
            loadComponent: () =>
              import('./features/super/schools-component/schools-component').then(
                (m) => m.SchoolsComponent
              ),
            canActivate: [superPermissionGuard(['schools.list', 'schools.manage'])],
          },
          {
            path: 'turso-dbs',
            loadComponent: () =>
              import('./features/super/turso-dbs-component/turso-dbs-component').then(
                (m) => m.TursoDbsComponent
              ),
            canActivate: [superPermissionGuard('turso.manage')],
          },

          // ── Payment system routes (inside super layout = gets sidebar) ──
          {
            path: 'invitations',
            loadComponent: () =>
              import('./features/super/invitations/invitations/invitations').then(
                (m) => m.Invitations
              ),
            canActivate: [superPermissionGuard('schools.invite')],
          },
          {
            path: 'approvals',
            loadComponent: () =>
              import('./features/super/approvals/approvals/approvals').then((m) => m.Approvals),
            canActivate: [superPermissionGuard('schools.manage')],
          },
          {
            path: 'payment-config',
            loadComponent: () =>
              import('./features/super/payment-config/payment-config/payment-config').then(
                (m) => m.PaymentConfigComponent
              ),
            canActivate: [superPermissionGuard('payments.config')],
          },

          // ── NEW: School Registration Requests ──────────────────────────────────
          {
            path: 'school-requests',
            loadComponent: () =>
              import('./features/super/school-requests/school-requests').then(
                (m) => m.SchoolRequests
              ),
            canActivate: [superPermissionGuard('school-requests.view')],
          },

          // ── NEW: School Contact / Support Messages ─────────────────────────────
          {
            path: 'contact-messages',
            loadComponent: () =>
              import('./features/super/contact-messages/contact-messages').then(
                (m) => m.ContactMessages
              ),
            canActivate: [superPermissionGuard('contact-messages.view')],
          },
          {
            path: 'permission-sync',
            loadComponent: () =>
              import(
                './features/super/school-permission-sync/permission-sync/permission-sync'
              ).then((m) => m.PermissionSync),
            canActivate: [superPermissionGuard('schools.manage')],
          },

          // Redirect bare /super to dashboard
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
        ],
      },

      // ── Utility ───────────────────────────────────────────────────────────────
      { path: 'unauthorized', component: Unauthorized },
      { path: '**', component: PageNotFound },
    ],
  },
];
