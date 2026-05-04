// dashboard.ts
// CHANGES vs original:
//  - Added getInitials(), getAttendanceRingColor(), getAttendanceDash(),
//    getFeeProgress() helper methods used by the parent dashboard template
//  - statCards computed: PARENT persona excluded (parent has its own card layout)
//  - quickLinks: uses link.key for track instead of link.label (more stable)

import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import {
  DashboardService,
  DashboardData,
  DashboardPersona,
} from '../../../core/services/dashboard.service';
import { ParentService } from '../../../core/services/parent.service';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, skip } from 'rxjs';
import { QUICK_LINKS_CONFIG, QuickLinkDef } from './quick-links.config';

interface StatCard {
  key: string;
  label: string;
  value: string | number;
  icon: string;
  accentVar: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private dashboardService = inject(DashboardService);
  private auth = inject(AuthService);
  private parentService = inject(ParentService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  data = signal<DashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly now = new Date();

  private activeChildId$ = toObservable(this.parentService.activeChildId).pipe(
    skip(1),
    distinctUntilChanged(),
    takeUntilDestroyed(this.destroyRef)
  );

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  userName = computed(() => this.auth.schoolUser()?.name?.split(' ')[0] ?? '');

  personaLabel = computed(() => {
    const labels: Record<DashboardPersona, string> = {
      OWNER: 'School Owner',
      MANAGEMENT: 'Management',
      TEACHER: 'Teacher',
      STUDENT: 'Student',
      PARENT: 'Parent',
      GENERAL_STAFF: 'Staff',
    };
    const persona = this.data()?.persona;
    if (!persona) return '';
    return labels[persona] ?? persona;
  });

  personaColorClass = computed(() => {
    const persona = this.data()?.persona;
    switch (persona) {
      case 'OWNER':
        return 'chip-owner';
      case 'MANAGEMENT':
        return 'chip-management';
      case 'TEACHER':
        return 'chip-teacher';
      case 'STUDENT':
        return 'chip-student';
      case 'PARENT':
        return 'chip-parent';
      default:
        return 'chip-staff';
    }
  });

  // PARENT persona has its own custom card layout — exclude from generic stat strip
  statCards = computed((): StatCard[] => {
    const stats = this.data()?.stats;
    const persona = this.data()?.persona;
    if (!stats || persona === 'PARENT') return [];

    const config: Record<
      string,
      { label: string; icon: string; accentVar: string; format?: 'currency' | 'percent' }
    > = {
      totalStudents: { label: 'Total Students', icon: 'school', accentVar: '--color-primary' },
      totalTeachers: {
        label: 'Total Teachers',
        icon: 'cast_for_education',
        accentVar: '--color-secondary',
      },
      totalStaff: { label: 'Total Staff', icon: 'badge', accentVar: '--color-info' },
      currentEnrollments: {
        label: 'Enrollments',
        icon: 'how_to_reg',
        accentVar: '--color-success',
      },
      feesCollected: {
        label: 'Fees Collected',
        icon: 'payments',
        accentVar: '--color-success',
        format: 'currency',
      },
      feesPending: {
        label: 'Fees Pending',
        icon: 'pending_actions',
        accentVar: '--color-warning',
        format: 'currency',
      },
      feeCollectionRate: {
        label: 'Collection Rate',
        icon: 'trending_up',
        accentVar: '--color-success',
        format: 'percent',
      },
      activeClassSections: { label: 'Active Classes', icon: 'class', accentVar: '--color-info' },
      attendancesMarkedToday: {
        label: 'Marked Today',
        icon: 'task_alt',
        accentVar: '--color-success',
      },
      pendingSubmissions: {
        label: 'Pending Submissions',
        icon: 'assignment_late',
        accentVar: '--color-warning',
      },
      attendancePercentage: {
        label: 'Attendance',
        icon: 'event_available',
        accentVar: '--color-primary',
        format: 'percent',
      },
      totalDaysTracked: {
        label: 'Days Tracked',
        icon: 'calendar_month',
        accentVar: '--color-info',
      },
      pendingAssignments: {
        label: 'Pending Tasks',
        icon: 'assignment',
        accentVar: '--color-warning',
      },
    };

    return Object.entries(stats)
      .filter(([key, val]) => val !== undefined && val !== null && config[key])
      .map(([key, val]) => {
        const c = config[key];
        let display: string | number = val as string | number;
        if (c.format === 'currency') display = '₹' + Number(val).toLocaleString('en-IN');
        if (c.format === 'percent') display = `${val}%`;
        return { key, label: c.label, value: display, icon: c.icon, accentVar: c.accentVar };
      });
  });

  quickLinks = computed(() => {
    const persona = this.data()?.persona;
    if (!persona) return [];
    return QUICK_LINKS_CONFIG.filter(
      (link) => link.personas.includes(persona) && this.auth.hasPermission(link.permission)
    );
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.load();
      });
    }
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.activeChildId$.subscribe(() => {
      if (this.auth.userRole() === 'STUDENT_PARENT') {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.getDashboard().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load dashboard');
        this.loading.set(false);
      },
    });
  }

  // ── Parent dashboard helpers ────────────────────────────────────────────

  /** Returns initials (up to 2 chars) from a full name */
  getInitials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Returns a CSS color variable for the SVG attendance ring */
  getAttendanceRingColor(pct: number | undefined): string {
    if (pct === undefined) return 'var(--color-divider)';
    if (pct >= 85) return 'var(--color-success)';
    if (pct >= 75) return 'var(--color-warning)';
    return 'var(--color-error)';
  }

  /**
   * Converts an attendance percentage to an SVG stroke-dasharray value.
   * Circle circumference = 2π × 32 ≈ 201.
   */
  getAttendanceDash(pct: number | undefined): string {
    const circ = 201;
    const filled = ((pct ?? 0) / 100) * circ;
    return `${filled} ${circ - filled}`;
  }

  /** Returns the fee payment progress as a rounded percentage */
  getFeeProgress(paid: number | undefined, total: number | undefined): number {
    if (!total || total === 0) return 0;
    return Math.round(((paid ?? 0) / total) * 100);
  }
}
