import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ATTENDANCE_STATUS_CONFIG,
  AttendanceService,
  AttendanceStatusValue,
  AttendanceSummary,
  ReconstructedAttendanceRecord,
  getReconstructedStatusDisplay,
} from '../../../../core/services/attendance.service';
import { ParentService, ParentChild } from '../../../../core/services/parent.service';
import {
  AttendanceCalendarDay,
  buildAttendanceCalendarDays,
} from '../../../../core/utils/attendance-calendar.util';

interface SummaryStat {
  key: 'present' | 'late' | 'halfDay' | 'absent' | 'sick' | 'suspended' | 'excused' | 'onDuty';
  status: AttendanceStatusValue;
}

const SUMMARY_STAT_KEYS: SummaryStat[] = [
  { key: 'present', status: 'PRESENT' },
  { key: 'late', status: 'LATE' },
  { key: 'halfDay', status: 'HALF_DAY' },
  { key: 'absent', status: 'ABSENT' },
  { key: 'sick', status: 'SICK' },
  { key: 'excused', status: 'EXCUSED' },
  { key: 'onDuty', status: 'ON_DUTY' },
  { key: 'suspended', status: 'SUSPENDED' },
];

// Statuses that should surface a "please check in" nudge for a parent.
const CONCERNING_STATUSES: AttendanceStatusValue[] = ['ABSENT', 'SUSPENDED'];

@Component({
  selector: 'app-parent-attendance-component',
  imports: [CommonModule],
  templateUrl: './parent-attendance-component.html',
  styleUrl: './parent-attendance-component.scss',
})
export class ParentAttendanceComponent implements OnInit {
  private attendanceService = inject(AttendanceService);
  private parentService = inject(ParentService);

  // ── State ────────────────────────────────────────────────────────────────
  loading = signal(false);
  error = signal<string | null>(null);
  attendanceRecords = signal<ReconstructedAttendanceRecord[]>([]);
  summary = signal<AttendanceSummary | null>(null);
  hoveredDate = signal<string | null>(null);
  showOnlyExceptions = signal(true);

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1);

  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly statusConfig = ATTENDANCE_STATUS_CONFIG;
  readonly getReconstructedStatusDisplay = getReconstructedStatusDisplay;

  // ── Parent / child state ─────────────────────────────────────────────────
  activeChild = computed(() => this.parentService.activeChild());
  activeChildId = computed(() => this.parentService.activeChildId());
  children = computed(() => this.parentService.children());
  hasMultipleChildren = computed(() => this.parentService.isParentWithMultipleChildren());

  // ── Navigation ───────────────────────────────────────────────────────────
  monthLabel = computed(() => {
    const d = new Date(this.selectedYear(), this.selectedMonth() - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  isCurrentOrFuture = computed(() => {
    const now = new Date();
    return (
      this.selectedYear() > now.getFullYear() ||
      (this.selectedYear() === now.getFullYear() && this.selectedMonth() >= now.getMonth() + 1)
    );
  });

  // ── Calendar ─────────────────────────────────────────────────────────────
  calendarDays = computed((): AttendanceCalendarDay[] =>
    buildAttendanceCalendarDays(this.selectedYear(), this.selectedMonth(), this.attendanceRecords())
  );

  // ── Gauge ────────────────────────────────────────────────────────────────
  ringDashArray = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    const circumference = 2 * Math.PI * 52;
    const filled = (pct / 100) * circumference;
    return `${filled.toFixed(2)} ${(circumference - filled).toFixed(2)}`;
  });

  ringColor = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    if (pct >= 75) return 'var(--color-success)';
    if (pct >= 60) return 'var(--color-warning)';
    return 'var(--color-error)';
  });

  standingLabel = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    if (pct >= 75) return 'Good Standing';
    if (pct >= 60) return 'Needs Improvement';
    return 'Critical';
  });

  standingClass = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    if (pct >= 75) return 'standing--good';
    if (pct >= 60) return 'standing--warn';
    return 'standing--bad';
  });

  // ── Child display ────────────────────────────────────────────────────────
  childInitials = computed(() => this.getChildInitials(this.activeChild()?.studentName ?? ''));

  enrollmentLabel = computed(() => {
    const e = this.activeChild()?.currentEnrollment;
    if (!e) return 'Not enrolled';
    return `${e.className} – ${e.sectionName} · ${e.academicYearName}`;
  });

  // ── Stats grid ───────────────────────────────────────────────────────────
  summaryStats = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return SUMMARY_STAT_KEYS.map((stat) => ({
      status: stat.status,
      value: s[stat.key],
      config: this.statusConfig[stat.status],
    }));
  });

  // ── Log list ─────────────────────────────────────────────────────────────
  visibleRecords = computed(() => {
    const sorted = [...this.attendanceRecords()].sort((a, b) => b.date.localeCompare(a.date));
    return this.showOnlyExceptions() ? sorted.filter((r) => r.status !== 'PRESENT') : sorted;
  });

  recentRecords = computed(() => this.visibleRecords().slice(0, 7));

  // ── Trend notice ─────────────────────────────────────────────────────────
  trendMessage = computed(() => {
    const all = [...this.attendanceRecords()].sort((a, b) => b.date.localeCompare(a.date));
    if (all.length < 5) return null;
    const recent = all.slice(0, 7);
    const concerning = recent.filter((r) => CONCERNING_STATUSES.includes(r.status as AttendanceStatusValue)).length;
    if (concerning >= 3) return { type: 'warning' as const, text: 'Multiple absences in recent days — please check in.' };
    if (concerning === 0 && recent.every((r) => r.status === 'PRESENT')) {
      return { type: 'excellent' as const, text: 'Perfect attendance this week!' };
    }
    return null;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  constructor() {
    // Reload whenever the active child changes (switcher in this view, or
    // elsewhere in the app — e.g. a global header selector).
    effect(() => {
      const childId = this.activeChildId();
      if (childId !== null) {
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    // effect() above handles the initial load once activeChildId resolves.
  }

  // ── Child selection ──────────────────────────────────────────────────────
  selectChild(child: ParentChild): void {
    this.parentService.setActiveChild(child.studentId);
  }

  // ── Navigation actions ───────────────────────────────────────────────────
  prevMonth(): void {
    if (this.selectedMonth() === 1) {
      this.selectedMonth.set(12);
      this.selectedYear.set(this.selectedYear() - 1);
    } else {
      this.selectedMonth.set(this.selectedMonth() - 1);
    }
    this.loadData();
  }

  nextMonth(): void {
    if (this.isCurrentOrFuture()) return;
    if (this.selectedMonth() === 12) {
      this.selectedMonth.set(1);
      this.selectedYear.set(this.selectedYear() + 1);
    } else {
      this.selectedMonth.set(this.selectedMonth() + 1);
    }
    this.loadData();
  }

  toggleExceptionsOnly(): void {
    this.showOnlyExceptions.update((v) => !v);
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  loadData(): void {
    if (this.activeChildId() === null) return;

    this.loading.set(true);
    this.error.set(null);

    const year = this.selectedYear();
    const month = this.selectedMonth();
    const fromDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    forkJoin({
      records: this.attendanceService.getForChild(fromDate, toDate).pipe(
        catchError((err) => {
          this.error.set(err?.error?.error || "Failed to load your child's attendance");
          return of({ attendance: [] as ReconstructedAttendanceRecord[] });
        })
      ),
      summary: this.attendanceService.getChildSummary(month, year).pipe(
        catchError(() => of({ summary: null as AttendanceSummary | null }))
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ records, summary }) => {
        this.attendanceRecords.set(records.attendance ?? []);
        this.summary.set(summary.summary ?? null);
      });
  }

  // ── Display helpers ──────────────────────────────────────────────────────
  statusClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  halfDaySessionLabel(rec: ReconstructedAttendanceRecord): string {
    if (!rec.halfDaySession) return '';
    return rec.halfDaySession === 'MORNING' ? 'Morning' : 'Afternoon';
  }

  formatDayNum(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').getDate().toString();
  }

  formatWeekday(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }

  getChildInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  trackByDate(_: number, day: AttendanceCalendarDay): string {
    return day.dateStr;
  }

  trackByRecord(_: number, rec: ReconstructedAttendanceRecord): string {
    return rec.id !== null ? `id-${rec.id}` : rec.date;
  }

  trackByChildId(_: number, child: ParentChild): number {
    return child.studentId;
  }
}