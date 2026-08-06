// student-attendance-component.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import {
  AttendanceCalendarDay,
  buildAttendanceCalendarDays,
} from '../../../../core/utils/attendance-calendar.util';

// Holiday is deliberately excluded here — getAttendanceSummaryForStudent always
// returns holiday: 0 (holidays are excluded from workingDays entirely now, so
// they carry no per-student count worth showing as a stat card). Holidays are
// still fully visible via the calendar grid and the exceptions log below.
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

@Component({
  selector: 'app-student-attendance-component',
  imports: [CommonModule],
  templateUrl: './student-attendance-component.html',
  styleUrl: './student-attendance-component.scss',
})
export class StudentAttendanceComponent implements OnInit {
  private attendanceService = inject(AttendanceService);

  // ── State ────────────────────────────────────────────────────────────────
  loading = signal(false);
  error = signal<string | null>(null);
  attendanceRecords = signal<ReconstructedAttendanceRecord[]>([]);
  summary = signal<AttendanceSummary | null>(null);
  hoveredDate = signal<string | null>(null);
  /** Default ON — implicit PRESENT days would otherwise dominate the log. */
  showOnlyExceptions = signal(true);

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1); // 1-indexed

  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly statusConfig = ATTENDANCE_STATUS_CONFIG;
  readonly getReconstructedStatusDisplay = getReconstructedStatusDisplay;

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
    // PRESENT is always implicit (backend never stores it) — filtering it out
    // is exactly "exceptions only": late/absent/sick/suspended/excused/on-duty/
    // holiday/unmarked all still show.
    return this.showOnlyExceptions() ? sorted.filter((r) => r.status !== 'PRESENT') : sorted;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadData();
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
    this.loading.set(true);
    this.error.set(null);

    const year = this.selectedYear();
    const month = this.selectedMonth();
    const fromDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    forkJoin({
      records: this.attendanceService.getBySelf(fromDate, toDate).pipe(
        catchError((err) => {
          this.error.set(err?.error?.error || 'Failed to load attendance records');
          return of({ attendance: [] as ReconstructedAttendanceRecord[] });
        })
      ),
      // Summary failure is non-critical — the calendar/log still render fine
      // without it, so it degrades quietly instead of blocking the page.
      summary: this.attendanceService.getSelfSummary(month, year).pipe(
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

  formatDay(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').getDate().toString().padStart(2, '0');
  }

  formatMonthShort(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
  }

  formatWeekday(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  trackByDate(_: number, day: AttendanceCalendarDay): string {
    return day.dateStr;
  }

  trackByRecord(_: number, rec: ReconstructedAttendanceRecord): string {
    return rec.id !== null ? `id-${rec.id}` : rec.date;
  }
}