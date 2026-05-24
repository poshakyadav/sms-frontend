// school-sidebar.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { APP_CONSTANTS } from '../../../app-constants';

/**
 * Slugs that belong ONLY to students. Never shown to staff even if they
 * have the '*' wildcard — the wildcard only covers 'staff' category slugs.
 */
const STUDENT_ONLY_SLUGS = new Set([
  'dashboard.student.view',
  'students.view.own',
  'attendance.student.view',
  'fees.student.view',
  'assignments.student.view',
  'assignments.student.submit',
  'exams.student.view',
  'exams.student.admit-card',
  'exams.student.report-card',
  'notifications.student.view',
]);

/**
 * Slugs that belong ONLY to parents. Never shown to staff even if they
 * have the '*' wildcard.
 */
const PARENT_ONLY_SLUGS = new Set([
  'dashboard.parent.view',
  'attendance.parent.view',
  'fees.parent.view',
  'assignments.parent.view',
  'exams.parent.view',
  'exams.parent.admit-card',
  'exams.parent.report-card',
  'notifications.parent.view',
]);

// ─── Nav definitions ──────────────────────────────────────────────────────────

export interface NavChild {
  label: string;
  route: string;
  icon: string;
  permissions: string[];
  /**
   * 'exact'   — only url === route is active (no sub-path matching at all).
   *             Use when another sibling route starts with this route as a prefix.
   *             e.g. '/school/students' vs '/school/students/bulk-upload'
   *
   * 'prefix'  — url === route OR url.startsWith(route + '/') is active (default).
   *             Use for most routes where deep-linking to a detail page should
   *             keep the parent item highlighted.
   */
  matchStrategy?: 'exact' | 'prefix';
}

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  permissions: string[];
  children?: NavChild[];
}

export interface NavGroup {
  groupLabel?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        label: 'Dashboard',
        icon: 'dashboard',
        route: '/school/dashboard',
        permissions: ['dashboard.view', 'dashboard.student.view', 'dashboard.parent.view'],
      },
      // {
      //   label: 'My Profile',
      //   icon: 'account_circle',
      //   route: '/school/profile/me',
      //   permissions: ['dashboard.view', 'dashboard.student.view', 'dashboard.parent.view'],
      // },
      // {
      //   label: 'About Us',
      //   icon: 'info',
      //   route: '/school/about-us',
      //   permissions: ['dashboard.view', 'dashboard.student.view', 'dashboard.parent.view'],
      // },
      // {
      //   label: 'School Contact',
      //   icon: 'contacts',
      //   route: '/school/school-contact',
      //   permissions: ['dashboard.view', 'dashboard.student.view', 'dashboard.parent.view'],
      // },
    ],
  },

  {
    groupLabel: 'Management',
    items: [
      {
        label: 'Users & Roles',
        icon: 'manage_accounts',
        permissions: ['users.list', 'roles.manage'],
        children: [
          {
            label: 'List Users',
            route: '/school/users',
            icon: 'list_alt',
            permissions: ['users.list'],
            matchStrategy: 'exact', // so it stays active when on /school/users/edit/123
          },
          {
            label: 'Add Users',
            route: '/school/users/create',
            icon: 'person_add',
            permissions: ['users.create'],
            matchStrategy: 'exact', // so it doesn't stay active when on /school/users/edit/123
          },
          {
            label: 'Roles',
            icon: 'admin_panel_settings',
            route: '/school/roles',
            permissions: ['roles.manage'],
          },
        ],
      },

      {
        label: 'Students & Parents',
        icon: 'groups',
        permissions: ['students.list'],
        children: [
          {
            label: 'All Students',
            route: '/school/students',
            icon: 'list_alt',
            permissions: ['students.list'],
            // CRITICAL FIX: 'exact' strategy — '/school/students/bulk-upload'
            // must NOT activate this item. '/school/students' is a strict
            // prefix of '/school/students/bulk-upload' so even adding '/' suffix
            // check is not enough — we need url === route only.
            matchStrategy: 'exact',
          },
          {
            label: 'Bulk Upload',
            route: '/school/students/bulk-upload',
            icon: 'upload_file',
            permissions: ['students.bulk-upload'],
            // prefix: any deeper page under bulk-upload keeps it active
            matchStrategy: 'prefix',
          },
          {
            label: 'Parents',
            icon: 'family_restroom',
            route: '/school/parents/link',
            permissions: ['parents.manage'],
          },
        ],
      },

      {
        label: 'Academics',
        icon: 'school',
        permissions: [
          'academics.years.manage',
          'academics.classes.manage',
          'academics.sections.manage',
          'academics.enroll',
          'academics.unenroll',
          'academics.subjects.manage',
          'academics.assign-teacher',
          'academics.mappings.manage',
        ],
        children: [
          {
            label: 'Academic Years',
            route: '/school/academics/years',
            icon: 'calendar_today',
            permissions: ['academics.years.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Classes',
            route: '/school/academics/classes',
            icon: 'class',
            permissions: ['academics.classes.manage'],
            // exact: '/school/academics/class-sections' must not match this
            matchStrategy: 'exact',
          },
          {
            label: 'Sections',
            route: '/school/academics/sections',
            icon: 'view_list',
            permissions: ['academics.sections.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Class-Sections',
            route: '/school/academics/class-sections',
            icon: 'grid_view',
            permissions: ['academics.classes.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Subjects',
            route: '/school/academics/subjects/list',
            icon: 'menu_book',
            permissions: ['academics.subjects.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Mappings',
            route: '/school/academics/mappings',
            icon: 'swap_horiz',
            permissions: ['academics.mappings.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Enroll',
            route: '/school/academics/enroll',
            icon: 'how_to_reg',
            permissions: ['academics.enroll', 'academics.unenroll'],
            matchStrategy: 'prefix',
          },
        ],
      },
      {
        label: 'Fees',
        icon: 'payments',
        permissions: [
          'fees.structures.manage',
          'fees.payments.record',
          'fees.report',
          'fees.ledger.view',
        ],
        children: [
          {
            label: 'Overview',
            route: '/school/fees/dashboard',
            icon: 'bar_chart',
            permissions: ['fees.report'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Fee Structures',
            route: '/school/fees/structures',
            icon: 'receipt_long',
            permissions: ['fees.structures.manage'],
            matchStrategy: 'prefix',
          },
          // {
          //   label: 'Record Payment',
          //   route: '/school/fees/payments/record',
          //   icon: 'point_of_sale',
          //   permissions: ['fees.payments.record'],
          //   matchStrategy: 'prefix',
          // },
          {
            label: 'Fee Report',
            route: '/school/fees/report',
            icon: 'summarize',
            permissions: ['fees.report'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Student Fee Detail',
            route: '/school/fees/student-detail',
            icon: 'manage_search',
            permissions: ['fees.report'],
            matchStrategy: 'prefix',
          },
          {
            label: "Fee Ladger",
            route: "/school/fees/ledger",
            icon: 'menu_book',
            permissions: ['fees.report', 'fees.ledger.view'],
            matchStrategy: 'prefix',
          },
          {
            label: "Concessions Dashboard",
            route: "/school/fees/concessions",
            icon: 'local_offer',
            permissions: ['fees.report'],
            matchStrategy: "prefix",
          },
        ],
      },
    ],
  },

  {
    groupLabel: 'Classroom',
    items: [
      {
        label: 'Attendance',
        icon: 'fact_check',
        permissions: ['attendance.mark', 'attendance.report'],
        children: [
          {
            label: 'Mark Attendance',
            route: '/school/attendance/mark',
            icon: 'edit_note',
            permissions: ['attendance.mark'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Reports',
            route: '/school/attendance/report',
            icon: 'analytics',
            permissions: ['attendance.report'],
            matchStrategy: 'prefix',
          },
        ],
      },
      {
        label: 'Assignments',
        icon: 'assignment',
        permissions: ['assignments.create', 'assignments.edit', 'assignments.grade'],
        children: [
          {
            label: 'All Assignments',
            route: '/school/assignments/list',
            icon: 'list_alt',
            permissions: ['assignments.create', 'assignments.grade'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Create New',
            route: '/school/assignments/new',
            icon: 'add_circle',
            permissions: ['assignments.create'],
            matchStrategy: 'prefix',
          },
        ],
      },
      {
        label: 'Exams',
        icon: 'quiz',
        permissions: ['exams.create', 'exams.edit', 'exams.marks.enter', 'exams.templates.manage'],
        children: [
          {
            label: 'Exam List',
            route: '/school/exams/list',
            icon: 'list_alt',
            permissions: ['exams.create', 'exams.marks.enter'],
            matchStrategy: 'prefix',
          },
          {
            label: 'Templates',
            route: '/school/exams/templates',
            icon: 'design_services',
            permissions: ['exams.templates.manage'],
            matchStrategy: 'prefix',
          },
        ],
      },
    ],
  },

  {
    groupLabel: 'My Academics',
    items: [
      {
        label: 'My Profile',
        icon: 'person',
        route: '/school/students/profile',
        permissions: ['students.view.own'],
      },
      {
        label: 'My Attendance',
        icon: 'event_available',
        route: '/school/attendance/my',
        permissions: ['attendance.student.view'],
      },
      {
        label: 'My Assignments',
        icon: 'assignment',
        route: '/school/assignments/my',
        permissions: ['assignments.student.view'],
      },
      {
        label: 'My Exams',
        icon: 'quiz',
        route: '/school/exams/student/my',
        permissions: ['exams.student.view'],
      },
      {
        label: 'My Fees',
        icon: 'payments',
        route: '/school/fees/student/my',
        permissions: ['fees.student.view'],
      },
    ],
  },

  {
    groupLabel: 'My Child',
    items: [
      {
        label: 'Attendance',
        icon: 'event_available',
        route: '/school/attendance/child',
        permissions: ['attendance.parent.view'],
      },
      {
        label: 'Assignments',
        icon: 'assignment',
        route: '/school/assignments/child',
        permissions: ['assignments.parent.view'],
      },
      {
        label: 'Exams',
        icon: 'quiz',
        route: '/school/exams/child',
        permissions: ['exams.parent.view'],
      },
      {
        label: 'Fees',
        icon: 'payments',
        route: '/school/fees/child',
        permissions: ['fees.parent.view'],
      },
    ],
  },

  {
    groupLabel: 'Communication',
    items: [
      {
        label: 'Notifications',
        icon: 'notifications',
        permissions: [
          'notifications.view',
          'notifications.student.view',
          'notifications.parent.view',
          'notifications.send',
        ],
        children: [
          {
            label: 'All Notifications',
            route: '/school/notifications/list',
            icon: 'list_alt',
            permissions: [
              'notifications.view',
              'notifications.student.view',
              'notifications.parent.view',
            ],
            matchStrategy: 'prefix',
          },
          {
            label: 'Send Notification',
            route: '/school/notifications/new',
            icon: 'send',
            permissions: ['notifications.send'],
            matchStrategy: 'prefix',
          },
        ],
      },
      {
        label: 'Contact Support',
        icon: 'support_agent',
        route: '/school/contact-us',
        permissions: ['contact.submit'],
      },
    ],
  },

  {
    groupLabel: 'System',
    items: [
      {
        label: 'Settings',
        icon: 'tune',
        permissions: ['settings.manage'],
        children: [
          {
            label: 'Theme',
            route: '/school/settings/theme',
            icon: 'palette',
            permissions: ['settings.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'School Info',
            route: '/school/settings/info',
            icon: 'business',
            permissions: ['settings.manage'],
            matchStrategy: 'prefix',
          },
          {
            label: 'About Us Editor',
            route: '/school/settings/about-us',
            icon: 'edit_note',
            permissions: ['settings.manage'],
            matchStrategy: 'prefix',
          },
        ],
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-school-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatRippleModule, MatTooltipModule],
  templateUrl: './school-sidebar.html',
  styleUrl: './school-sidebar.scss',
})
export class SchoolSidebar implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  isCollapsed = signal(false);
  mobileOpen = signal(false);
  currentRoute = signal('');
  expandedItems = signal<Set<string>>(new Set());

  /** Controls the logout confirmation modal */
  logoutModalOpen = signal(false);

  private routerSub!: Subscription;

  readonly appConstants = APP_CONSTANTS;

  // ── PBAC-filtered navigation ─────────────────────────────────────────────
  filteredGroups = computed<NavGroup[]>(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .filter((item) => this.hasAnyPermission(item.permissions))
        .map((item) => ({
          ...item,
          children: item.children?.filter((c) => this.hasAnyPermission(c.permissions)),
        }))
        .filter((item) => !item.children || item.children.length > 0),
    })).filter((group) => group.items.length > 0);
  });

  // ── User info ─────────────────────────────────────────────────────────────
  userName = computed(() => {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      const u = this.auth.schoolUser();
      return u?.name ?? u?.email ?? '';
    } catch {
      return '';
    }
  });

  userInitials = computed(() => {
    const name = this.userName();
    if (!name) return '?';
    return name
      .trim()
      .split(/\s+/)
      .map((w: string) => w[0].toUpperCase())
      .join('')
      .slice(0, 2);
  });

  schoolCode = computed(() => this.auth.schoolCode() ?? '');

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.currentRoute.set(this.router.url);
    this.autoExpandActive(this.router.url);

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentRoute.set(e.urlAfterRedirects);
        this.autoExpandActive(e.urlAfterRedirects);
        this.mobileOpen.set(false);
      });

    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') this.isCollapsed.set(true);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  // ── Route matching ────────────────────────────────────────────────────────

  /**
   * Central route-matching logic for child nav items.
   *
   * Strategy 'exact'  → url must equal route precisely.
   *   Used for: 'All Students' (/school/students) so that navigating to
   *   /school/students/bulk-upload does NOT activate it.
   *
   * Strategy 'prefix' (default) → url === route OR url starts with route + '/'
   *   Used for: everything else, so detail/sub pages keep the parent highlighted.
   */
  private matchesChildRoute(url: string, child: NavChild): boolean {
    const strategy = child.matchStrategy ?? 'prefix';

    if (strategy === 'exact') {
      // Strip query params and fragments before comparing
      const cleanUrl = url.split('?')[0].split('#')[0];
      return cleanUrl === child.route;
    }

    // 'prefix' strategy — match the route itself or any child path
    return url === child.route || url.startsWith(child.route + '/');
  }

  // private hasAnyPermission(permissions: string[]): boolean {
  //   return permissions.some((p) => this.auth.hasPermission(p));
  // }

  /**
   * SIDEBAR-SPECIFIC permission check.
   *
   * Differs from auth.hasPermission() in one critical way:
   * the '*' wildcard (School Owner) does NOT match student/parent category slugs.
   *
   * This prevents the "My Academics" and "My Child" sidebar groups from
   * appearing for the School Owner, even though auth.hasPermission('*') = true.
   *
   * auth.hasPermission() is intentionally NOT used here to avoid changing its
   * behaviour globally (route guards and component templates rely on the current
   * wildcard semantics for staff slugs).
   */
  private hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((slug) => this.canSeeSidebarItem(slug));
  }

  private canSeeSidebarItem(slug: string): boolean {
    const userPerms = this.auth.permissions();
    const isWildcard = userPerms.includes('*');

    // Wildcard users (School Owner) never see student/parent-only nav items
    if (isWildcard) {
      if (STUDENT_ONLY_SLUGS.has(slug) || PARENT_ONLY_SLUGS.has(slug)) {
        return false;
      }
      // Wildcard covers all staff slugs
      return true;
    }

    // Non-wildcard: normal exact match
    return userPerms.includes(slug);
  }

  /**
   * FIX: autoExpandActive now uses matchesChildRoute (respects matchStrategy)
   * instead of bare url.startsWith(c.route) so it is consistent with
   * isChildActive and won't incorrectly expand a group based on a prefix clash.
   */
  private autoExpandActive(url: string): void {
    const expanded = new Set<string>();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children?.some((c) => this.matchesChildRoute(url, c))) {
          expanded.add(item.label);
        }
      }
    }
    this.expandedItems.set(expanded);
  }

  isItemActive(item: NavItem): boolean {
    const url = this.currentRoute();
    if (item.route) return url === item.route || url.startsWith(item.route + '/');
    return item.children?.some((c) => this.matchesChildRoute(url, c)) ?? false;
  }

  isChildActive(child: NavChild): boolean {
    return this.matchesChildRoute(this.currentRoute(), child);
  }

  isExpanded(label: string): boolean {
    return this.expandedItems().has(label);
  }

  toggleExpand(item: NavItem): void {
    if (!item.children) return;
    const set = new Set(this.expandedItems());
    if (set.has(item.label)) {
      set.delete(item.label);
    } else {
      set.add(item.label);
    }
    this.expandedItems.set(set);
  }

  toggleCollapse(): void {
    const next = !this.isCollapsed();
    this.isCollapsed.set(next);
    if (!next) {
      this.autoExpandActive(this.currentRoute());
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('sidebarCollapsed', String(next));
    }
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  // ── Logout modal ──────────────────────────────────────────────────────────
  openLogoutModal(): void {
    this.logoutModalOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutModalOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.auth.logout();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.logoutModalOpen()) {
      this.logoutModalOpen.set(false);
      return;
    }
    this.mobileOpen.set(false);
  }

  /** @deprecated Use openLogoutModal() instead */
  logout(): void {
    this.openLogoutModal();
  }

  /** Navigate to profile — called from the footer user-row click */
  goToProfile(): void {
    this.router.navigate(['/school/profile/me']);
    this.mobileOpen.set(false);
  }
}
