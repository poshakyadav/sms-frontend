import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ParentService, ParentChild } from '../../../../core/services/parent.service';
import { HttpParams } from '@angular/common/http';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

interface AttendanceRecord {
  id: number;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  createdAt: string;
}

interface AttendanceSummary {
  month: number;
  year: number;
  totalDaysInMonth: number;
  markedDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  attendancePercentage: number;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  status: AttendanceStatus | null;
  notes?: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-parent-attendance-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-attendance-component.html',
  styleUrl: './parent-attendance-component.scss',
})
export class ParentAttendanceComponent implements OnInit {
  private api = inject(ApiService);
  private parentService = inject(ParentService);

  // ── State Signals ─────────────────────────────────────────────────────────
  loading = signal(false);
  error = signal<string | null>(null);
  attendanceRecords = signal<AttendanceRecord[]>([]);
  summary = signal<AttendanceSummary | null>(null);
  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1); // 1-indexed
  hoveredDate = signal<string | null>(null);

  // ── Computed: Parent/Child State ──────────────────────────────────────────
  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  activeChild = computed(() => this.parentService.activeChild());
  activeChildId = computed(() => this.parentService.activeChildId());
  children = computed(() => this.parentService.children());
  hasMultipleChildren = computed(() => this.parentService.isParentWithMultipleChildren());

  // ── Computed: Month / Navigation ──────────────────────────────────────────
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

  // ── Computed: Calendar Grid ───────────────────────────────────────────────
  calendarDays = computed((): CalendarDay[] => {
    const year = this.selectedYear();
    const month = this.selectedMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const recordMap = new Map<string, AttendanceRecord>();
    this.attendanceRecords().forEach((r) => recordMap.set(r.date, r));

    const days: CalendarDay[] = [];

    // Pad start (previous month trailing days)
    for (let i = 0; i < firstDay.getDay(); i++) {
      const d = new Date(year, month - 1, -firstDay.getDay() + i + 1);
      days.push({
        date: d,
        dateStr: this.toDateStr(d),
        status: null,
        isCurrentMonth: false,
        isToday: false,
        isFuture: false,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = this.toDateStr(date);
      const rec = recordMap.get(dateStr);
      const isToday = date.getTime() === today.getTime();
      const isFuture = date > today;
      days.push({
        date,
        dateStr,
        status: rec?.status ?? null,
        notes: rec?.notes,
        isCurrentMonth: true,
        isToday,
        isFuture,
      });
    }

    // Pad end (next month leading days)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month, i);
        days.push({
          date: d,
          dateStr: this.toDateStr(d),
          status: null,
          isCurrentMonth: false,
          isToday: false,
          isFuture: false,
        });
      }
    }

    return days;
  });

  // ── Computed: Ring Gauge (SVG circle) ─────────────────────────────────────
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

  // ── Computed: Child Display ───────────────────────────────────────────────
  childInitials = computed(() => {
    const name = this.activeChild()?.studentName;
    if (!name) return '?';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  enrollmentLabel = computed(() => {
    const e = this.activeChild()?.currentEnrollment;
    if (!e) return 'Not enrolled';
    return `${e.className} – ${e.sectionName} · ${e.academicYearName}`;
  });

  // ── Computed: Recent Records (last 7 non-future days with status) ─────────
  recentRecords = computed(() => {
    return [...this.attendanceRecords()]
      .filter((r) => r.status)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  });

  // ── Computed: Trend ───────────────────────────────────────────────────────
  trendMessage = computed(() => {
    const records = this.attendanceRecords();
    if (records.length < 5) return null;
    const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const absentCount = recent.filter((r) => r.status === 'ABSENT').length;
    if (absentCount >= 3)
      return { type: 'warning', text: 'Multiple absences in recent days — please check in.' };
    if (absentCount === 0) return { type: 'excellent', text: 'Perfect attendance this week!' };
    return null;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  constructor() {
    // React to active child changes (e.g., child switcher in parent layout)
    effect(() => {
      const childId = this.activeChildId();
      if (childId !== null) {
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    // effect() handles loading when activeChildId changes, including initial load
  }

  // ── Child Selection ───────────────────────────────────────────────────────
  selectChild(child: ParentChild): void {
    this.parentService.setActiveChild(child.studentId);
    // effect() will trigger loadData automatically
  }

  // ── Month Navigation ──────────────────────────────────────────────────────
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

  // ── Data Loading ──────────────────────────────────────────────────────────
  loadData(): void {
    if (this.activeChildId() === null) return;

    this.loading.set(true);
    this.error.set(null);
    this.attendanceRecords.set([]);
    this.summary.set(null);

    const year = this.selectedYear();
    const month = this.selectedMonth();
    const fromDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
      .toString()
      .padStart(2, '0')}`;

    let recordsDone = false;
    let summaryDone = false;
    let hasError = false;

    const checkDone = () => {
      if (recordsDone && summaryDone) this.loading.set(false);
    };

    // Fetch attendance records
    const recParams = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    this.api
      .get<{ attendance: AttendanceRecord[] }>('school/attendance/child', recParams)
      .subscribe({
        next: (res) => {
          this.attendanceRecords.set(res.attendance ?? []);
          recordsDone = true;
          checkDone();
        },
        error: (err) => {
          if (!hasError) {
            hasError = true;
            this.error.set(err?.error?.error || "Failed to load your child's attendance");
            this.loading.set(false);
          }
          recordsDone = true;
          checkDone();
        },
      });

    // Fetch monthly summary
    const sumParams = new HttpParams().set('month', month.toString()).set('year', year.toString());
    this.api
      .get<{ summary: AttendanceSummary }>('school/attendance/child/summary', sumParams)
      .subscribe({
        next: (res) => {
          this.summary.set(res.summary ?? null);
          summaryDone = true;
          checkDone();
        },
        error: () => {
          // Summary failure is non-critical; calendar still shows
          summaryDone = true;
          checkDone();
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private toDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  statusLabel(status: AttendanceStatus | null): string {
    const map: Record<AttendanceStatus, string> = {
      PRESENT: 'Present',
      ABSENT: 'Absent',
      LATE: 'Late',
      HALF_DAY: 'Half Day',
    };
    return status ? map[status] : '—';
  }

  statusIcon(status: AttendanceStatus | null): string {
    const map: Record<AttendanceStatus, string> = {
      PRESENT: '✓',
      ABSENT: '✗',
      LATE: '⏱',
      HALF_DAY: '◑',
    };
    return status ? map[status] : '';
  }

  statusCssClass(status: AttendanceStatus | null): string {
    const map: Record<AttendanceStatus, string> = {
      PRESENT: 'status--present',
      ABSENT: 'status--absent',
      LATE: 'status--late',
      HALF_DAY: 'status--half',
    };
    return status ? map[status] : '';
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
    return name
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  trackByDate(_: number, day: CalendarDay): string {
    return day.dateStr;
  }

  trackByChildId(_: number, child: ParentChild): number {
    return child.studentId;
  }

  trackById(_: number, rec: AttendanceRecord): number {
    return rec.id;
  }
}
