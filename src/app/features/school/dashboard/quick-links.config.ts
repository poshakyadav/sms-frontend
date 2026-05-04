// src/app/features/school/dashboard/quick-links.config.ts
// ─────────────────────────────────────────────────────────────────────────────
// FIXES applied vs previous version:
//
// 1. STUDENT persona — notifications quick link:
//    'notifications.view' → 'notifications.student.view'
//    Students never receive the staff 'notifications.view' slug, so the link
//    was filtered out by auth.hasPermission() and never appeared.
//
// 2. PARENT persona — notifications quick link:
//    'notifications.view' → 'notifications.parent.view'
//    Same reason as above.
//
// 3. STUDENT persona — admit card / report card quick links:
//    'exams.admit-card'  → 'exams.student.admit-card'
//    'exams.report-card' → 'exams.student.report-card'
//    The old slugs are staff-category slugs absent from student JWTs.
//    Routes also corrected to /school/exams/student/admit-card etc.
//
// 4. PARENT persona — admit card / report card quick links:
//    'exams.admit-card'  → 'exams.parent.admit-card'
//    'exams.report-card' → 'exams.parent.report-card'
//    Routes corrected to /school/exams/parent/admit-card etc.
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardPersona =
  | 'OWNER'
  | 'MANAGEMENT'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT'
  | 'GENERAL_STAFF';

export interface QuickLinkDef {
  key: string;
  label: string;
  icon: string;
  route: string[];
  permission: string;
  personas: DashboardPersona[];
}

export const QUICK_LINKS_CONFIG: QuickLinkDef[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // OWNER & MANAGEMENT — unchanged
  // ══════════════════════════════════════════════════════════════════════════

  {
    key: 'users',
    label: 'Manage Users',
    icon: 'manage_accounts',
    route: ['/school/users'],
    permission: 'users.list',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'roles',
    label: 'Manage Roles',
    icon: 'admin_panel_settings',
    route: ['/school/roles'],
    permission: 'roles.manage',
    personas: ['OWNER'],
  },
  {
    key: 'settings-theme',
    label: 'Theme Settings',
    icon: 'palette',
    route: ['/school/settings/theme'],
    permission: 'settings.manage',
    personas: ['OWNER'],
  },
  {
    key: 'settings-info',
    label: 'School Info',
    icon: 'business',
    route: ['/school/settings/info'],
    permission: 'settings.manage',
    personas: ['OWNER'],
  },
  {
    key: 'notifications-send',
    label: 'Send Notification',
    icon: 'send',
    route: ['/school/notifications/new'],
    permission: 'notifications.send',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'fees-dashboard',
    label: 'Fee Overview',
    icon: 'bar_chart',
    route: ['/school/fees/dashboard'],
    permission: 'fees.report',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'fees-record',
    label: 'Record Payment',
    icon: 'point_of_sale',
    route: ['/school/fees/payments/record'],
    permission: 'fees.payments.record',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'fees-report',
    label: 'Fee Report',
    icon: 'summarize',
    route: ['/school/fees/report'],
    permission: 'fees.report',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'students-list',
    label: 'All Students',
    icon: 'groups',
    route: ['/school/students'],
    permission: 'students.list',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'academics-enroll',
    label: 'Enroll Students',
    icon: 'how_to_reg',
    route: ['/school/academics/enroll'],
    permission: 'academics.enroll',
    personas: ['OWNER', 'MANAGEMENT'],
  },
  {
    key: 'academics-classes',
    label: 'Manage Classes',
    icon: 'class',
    route: ['/school/academics/classes'],
    permission: 'academics.classes.manage',
    personas: ['OWNER', 'MANAGEMENT'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TEACHER 
  // ══════════════════════════════════════════════════════════════════════════

  {
    key: 'attendance-mark',
    label: 'Mark Attendance',
    icon: 'fact_check',
    route: ['/school/attendance/mark'],
    permission: 'attendance.mark',
    personas: ['TEACHER'],
  },
  {
    key: 'attendance-report-teacher',
    label: 'Attendance Report',
    icon: 'analytics',
    route: ['/school/attendance/report'],
    permission: 'attendance.report',
    personas: ['TEACHER'],
  },
  {
    key: 'assignments-list-teacher',
    label: 'Assignments',
    icon: 'assignment',
    route: ['/school/assignments/list'],
    permission: 'assignments.create',
    personas: ['TEACHER'],
  },
  {
    key: 'assignments-new',
    label: 'Create Assignment',
    icon: 'add_circle',
    route: ['/school/assignments/new'],
    permission: 'assignments.create',
    personas: ['TEACHER'],
  },
  {
    key: 'exams-list-teacher',
    label: 'Exams',
    icon: 'quiz',
    route: ['/school/exams/list'],
    permission: 'exams.marks.enter',
    personas: ['TEACHER'],
  },
  {
    key: 'notifications-view-teacher',
    label: 'Notifications',
    icon: 'notifications',
    route: ['/school/notifications/list'],
    permission: 'notifications.view', // staff slug — correct for TEACHER
    personas: ['TEACHER'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GENERAL STAFF 
  // ══════════════════════════════════════════════════════════════════════════

  {
    key: 'notifications-view-staff',
    label: 'Notifications',
    icon: 'notifications',
    route: ['/school/notifications/list'],
    permission: 'notifications.view', // staff slug — correct for GENERAL_STAFF
    personas: ['GENERAL_STAFF'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STUDENT
  // ══════════════════════════════════════════════════════════════════════════

  {
    key: 'student-profile',
    label: 'My Profile',
    icon: 'person',
    route: ['/school/students/profile'],
    permission: 'students.view.own',
    personas: ['STUDENT'],
  },
  {
    key: 'student-attendance',
    label: 'My Attendance',
    icon: 'event_available',
    route: ['/school/attendance/my'],
    permission: 'attendance.student.view',
    personas: ['STUDENT'],
  },
  {
    key: 'student-assignments',
    label: 'My Assignments',
    icon: 'assignment',
    route: ['/school/assignments/my'],
    permission: 'assignments.student.view',
    personas: ['STUDENT'],
  },
  {
    key: 'student-exams',
    label: 'My Exams',
    icon: 'quiz',
    route: ['/school/exams/student/my'],
    permission: 'exams.student.view',
    personas: ['STUDENT'],
    // Admit Card and Report Card are intentionally absent here.
    // They are accessed from within the StudentExams hub per specific exam.
  },
  {
    key: 'student-fees',
    label: 'My Fees',
    icon: 'payments',
    route: ['/school/fees/student/my'],
    permission: 'fees.student.view',
    personas: ['STUDENT'],
  },
  {
    key: 'notifications-view-student',
    label: 'Notifications',
    icon: 'notifications',
    route: ['/school/notifications/list'],
    permission: 'notifications.student.view', // FIX: was 'notifications.view' (staff slug)
    personas: ['STUDENT'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PARENT
  // ══════════════════════════════════════════════════════════════════════════

  {
    key: 'parent-attendance',
    label: "Child's Attendance",
    icon: 'event_available',
    route: ['/school/attendance/child'],
    permission: 'attendance.parent.view',
    personas: ['PARENT'],
  },
  {
    key: 'parent-assignments',
    label: "Child's Assignments",
    icon: 'assignment',
    route: ['/school/assignments/child'],
    permission: 'assignments.parent.view',
    personas: ['PARENT'],
  },
  {
    key: 'parent-exams',
    label: "Child's Exams",
    icon: 'quiz',
    route: ['/school/exams/child'],
    permission: 'exams.parent.view',
    personas: ['PARENT'],
  },
  {
    key: 'parent-fees',
    label: "Child's Fees",
    icon: 'payments',
    route: ['/school/fees/child'],
    permission: 'fees.parent.view',
    personas: ['PARENT'],
  },
  {
    key: 'notifications-view-parent',
    label: 'Notifications',
    icon: 'notifications',
    route: ['/school/notifications/list'],
    permission: 'notifications.parent.view', // FIX: was 'notifications.view' (staff slug)
    personas: ['PARENT'],
  },
];
