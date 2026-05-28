// dashboard.ts

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
  AttendanceCoverageItem,
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

// ── Fee stat keys excluded from the OWNER stat strip ─────────────────────────
// The owner has a dedicated /school/fees/dashboard for this data.
// Keeping them here caused confusion (duplicate reporting surface).
const OWNER_EXCLUDED_STAT_KEYS = new Set(['feesCollected', 'feesPending', 'feeCollectionRate']);

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

  // ── Stat cards ──────────────────────────────────────────────────────────────
  // Rules:
  //   1. PARENT persona always excluded — it has its own custom card layout.
  //   2. OWNER persona: feesCollected / feesPending / feeCollectionRate excluded.
  //   3. sectionsMarkedToday is rendered as "X / Y" composite (not raw number).
  statCards = computed((): StatCard[] => {
    const stats = this.data()?.stats;
    const persona = this.data()?.persona;
    if (!stats || persona === 'PARENT') return [];

    const config: Record<
      string,
      {
        label: string;
        icon: string;
        accentVar: string;
        format?: 'currency' | 'percent' | 'attendance-coverage';
      }
    > = {
      totalStudents: {
        label: 'Total Students',
        icon: 'school',
        accentVar: '--color-primary',
      },
      totalTeachers: {
        label: 'Total Teachers',
        icon: 'cast_for_education',
        accentVar: '--color-secondary',
      },
      totalStaff: {
        label: 'Total Staff',
        icon: 'badge',
        accentVar: '--color-info',
      },
      currentEnrollments: {
        label: 'Enrollments',
        icon: 'how_to_reg',
        accentVar: '--color-success',
      },
      // Fee stats intentionally kept in config so MANAGEMENT sees them,
      // but OWNER_EXCLUDED_STAT_KEYS filters them out for OWNER below.
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
      activeClassSections: {
        label: 'Active Classes',
        icon: 'class',
        accentVar: '--color-info',
      },
      // ── Attendance coverage summary chip (OWNER / MANAGEMENT) ──────────────
      // Raw value = sectionsMarkedToday; totalActiveSections comes from stats.
      // We format it as "X / Y Sections" in the display value below.
      sectionsMarkedToday: {
        label: "Today's Attendance",
        icon: 'fact_check',
        accentVar: '--color-success',
        format: 'attendance-coverage',
      },
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
      .filter(([key, val]) => {
        if (val === undefined || val === null || !config[key]) return false;
        // Strip fee cards for OWNER — dedicated fee dashboard exists
        if (persona === 'OWNER' && OWNER_EXCLUDED_STAT_KEYS.has(key)) return false;
        // totalActiveSections is only used as denominator inside the composite
        // attendance-coverage chip — don't render it as its own card
        if (key === 'totalActiveSections') return false;
        return true;
      })
      .map(([key, val]) => {
        const c = config[key];
        let display: string | number = val as string | number;

        if (c.format === 'currency') {
          display = '₹' + Number(val).toLocaleString('en-IN');
        } else if (c.format === 'percent') {
          display = `${val}%`;
        } else if (c.format === 'attendance-coverage') {
          // "8 / 12 Sections" — reads totalActiveSections from the same stats object
          const total = stats['totalActiveSections'] ?? 0;
          display = `${val} / ${total}`;
        }

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

  // ── Attendance coverage helpers ─────────────────────────────────────────────

  /**
   * Sublabel shown under the class-section name in the coverage list.
   * Examples:
   *   "38 / 40 students marked"
   *   "Not marked yet"
   *   "No students enrolled"
   */
  getCoverageLabel(item: AttendanceCoverageItem): string {
    if (item.totalEnrolled === 0) return 'No students enrolled';
    if (!item.isMarked) return 'Not marked yet';
    return `${item.markedCount} / ${item.totalEnrolled} students marked`;
  }

  /**
   * Progress bar fill width (0–100%) for a coverage row.
   * 0 when not marked, partial when some students are recorded.
   */
  getCoverageProgress(item: AttendanceCoverageItem): number {
    if (!item.isMarked || item.totalEnrolled === 0) return 0;
    return Math.round((item.markedCount / item.totalEnrolled) * 100);
  }

  /**
   * Accent color for the coverage row icon and progress bar.
   * Green = fully marked (100%), Amber = partial, Red = not started.
   */
  getCoverageAccent(item: AttendanceCoverageItem): string {
    if (!item.isMarked) return 'var(--color-error)';
    const pct = this.getCoverageProgress(item);
    if (pct >= 100) return 'var(--color-success)';
    if (pct >= 50) return 'var(--color-warning)';
    return 'var(--color-warning)';
  }

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

  // ── Parent dashboard helpers ────────────────────────────────────────────────

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getAttendanceRingColor(pct: number | undefined): string {
    if (pct === undefined) return 'var(--color-divider)';
    if (pct >= 85) return 'var(--color-success)';
    if (pct >= 75) return 'var(--color-warning)';
    return 'var(--color-error)';
  }

  getAttendanceDash(pct: number | undefined): string {
    const circ = 201;
    const filled = ((pct ?? 0) / 100) * circ;
    return `${filled} ${circ - filled}`;
  }

  formatRupees(paise: number | string | undefined): string {
    if (paise === undefined || paise === null) return '₹0';
    const val = typeof paise === 'string' ? parseFloat(paise) : paise;
    if (isNaN(val)) return '₹0';
    return '₹' + (val / 100).toLocaleString('en-IN');
  }

  getFeeProgress(paid: number | string | undefined, total: number | string | undefined): number {
    if (!total) return 0;
    const totalNum = typeof total === 'string' ? parseFloat(total) : total;
    const paidNum = typeof paid === 'string' ? parseFloat(paid ?? '0') : paid ?? 0;
    if (!totalNum || totalNum === 0) return 0;
    return Math.round((paidNum / totalNum) * 100);
  }

  //  used in template for safe numeric comparisons
  // on DashboardStats values (index signature returns string | number | undefined)
  toNum(val: string | number | undefined): number {
    if (val === undefined || val === null) return 0;
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(n) ? 0 : n;
  }
}
