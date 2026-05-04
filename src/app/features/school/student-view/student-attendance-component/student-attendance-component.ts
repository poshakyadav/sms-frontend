import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
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
  selector: 'app-student-attendance-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './student-attendance-component.html',
  styleUrl: './student-attendance-component.scss',
})
export class StudentAttendanceComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // ── Signals ──────────────────────────────────────────────────────────────
  loading = signal(false);
  error = signal<string | null>(null);
  attendanceRecords = signal<AttendanceRecord[]>([]);
  summary = signal<AttendanceSummary | null>(null);

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1); // 1-indexed

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

    // Pad start
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

    // Current month
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

    // Pad end to complete grid rows
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

  ringDashArray = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    const circumference = 2 * Math.PI * 50;
    const filled = (pct / 100) * circumference;
    return `${filled} ${circumference - filled}`;
  });

  ringColor = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    if (pct >= 75) return '#059669';
    if (pct >= 60) return '#d97706';
    return '#dc2626';
  });

  pctLabel = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    if (pct >= 75) return '✓ Good Standing';
    if (pct >= 60) return '⚠ Needs Improvement';
    return '✗ Critical';
  });

  pctBadgeClass = computed(() => {
    const pct = this.summary()?.attendancePercentage ?? 0;
    if (pct >= 75) return 'sa-pct-badge sa-pct-good';
    if (pct >= 60) return 'sa-pct-badge sa-pct-ok';
    return 'sa-pct-badge sa-pct-bad';
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadData();
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  prevMonth() {
    if (this.selectedMonth() === 1) {
      this.selectedMonth.set(12);
      this.selectedYear.set(this.selectedYear() - 1);
    } else {
      this.selectedMonth.set(this.selectedMonth() - 1);
    }
    this.loadData();
  }

  nextMonth() {
    if (this.isCurrentOrFuture()) return;
    if (this.selectedMonth() === 12) {
      this.selectedMonth.set(1);
      this.selectedYear.set(this.selectedYear() + 1);
    } else {
      this.selectedMonth.set(this.selectedMonth() + 1);
    }
    this.loadData();
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  loadData() {
    this.loading.set(true);
    this.error.set(null);

    const year = this.selectedYear();
    const month = this.selectedMonth();
    const fromDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
      .toString()
      .padStart(2, '0')}`;

    // Parallel: fetch records + summary
    let recordsDone = false;
    let summaryDone = false;
    let hasError = false;

    const checkDone = () => {
      if (recordsDone && summaryDone) this.loading.set(false);
    };

    // Records
    const recParams = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    this.api.get<{ attendance: AttendanceRecord[] }>('school/attendance/me', recParams).subscribe({
      next: (res) => {
        this.attendanceRecords.set(res.attendance ?? []);
        recordsDone = true;
        checkDone();
      },
      error: (err) => {
        if (!hasError) {
          hasError = true;
          this.error.set(err?.error?.error || 'Failed to load attendance records');
          this.loading.set(false);
        }
        recordsDone = true;
        checkDone();
      },
    });

    // Summary
    const sumParams = new HttpParams().set('month', month.toString()).set('year', year.toString());
    this.api
      .get<{ summary: AttendanceSummary }>('school/attendance/me/summary', sumParams)
      .subscribe({
        next: (res) => {
          this.summary.set(res.summary ?? null);
          summaryDone = true;
          checkDone();
        },
        error: () => {
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
}
