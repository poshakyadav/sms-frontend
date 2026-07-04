// attendance-report-component.ts

import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Subject } from 'rxjs';
import {
  AcademicsService,
  ClassSection,
  Enrollment,
} from '../../../../core/services/academics.service';
import {
  AttendanceReportItem,
  AttendanceService,
} from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-attendance-report-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    DecimalPipe,
  ],
  templateUrl: './attendance-report-component.html',
  styleUrl: './attendance-report-component.scss',
})
export class AttendanceReportComponent implements OnInit, OnDestroy {
  private attendance = inject(AttendanceService);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  // ── Data signals ──────────────────────────────────────────────────────────
  report = signal<AttendanceReportItem[]>([]);
  classSections = signal<ClassSection[]>([]);
  // enrollments = signal<Enrollment[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  loading = signal(false);
  loadingMeta = signal(true); // loading class-sections + enrollments
  error = signal<string | null>(null);
  hasGenerated = signal(false);

  displayedColumns = [
    'rank',
    'rollNumber',
    'studentName',
    'totalMarkedDays',
    'present',
    'absent',
    'late',
    'halfDay',
    'attendancePercentage',
  ];

  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // ── Computed statistics ───────────────────────────────────────────────────
  averageAttendance = computed(() => {
    const data = this.report();
    if (!data.length) return 0;
    return Math.round(data.reduce((sum, r) => sum + r.attendancePercentage, 0) / data.length);
  });

  aboveThreshold = computed(() => this.report().filter((r) => r.attendancePercentage >= 75).length);
  belowThreshold = computed(() => this.report().filter((r) => r.attendancePercentage < 75).length);
  criticalCount = computed(() => this.report().filter((r) => r.attendancePercentage < 60).length);

  totalPresent = computed(() => this.report().reduce((s, r) => s + r.present, 0));
  totalAbsent = computed(() => this.report().reduce((s, r) => s + r.absent, 0));

  /** Selected class-section label for display */
  selectedSectionLabel = computed(() => {
    const id = this.form.value.classSectionId;
    if (!id) return 'All Sections';
    const cs = this.classSections().find((c) => c.id === id);
    return cs ? `${cs.className} – ${cs.sectionName}` : 'All Sections';
  });

  /** Enrollments filtered by selected class-section for the student dropdown */
  // filteredEnrollments = computed(() => {
  //   const csId = this.form.value.classSectionId;
  //   if (!csId) return this.enrollments();
  //   return this.enrollments().filter((e) => e.classSectionId === csId);
  // });

  // ── Form ──────────────────────────────────────────────────────────────────
  form = this.fb.group({
    classSectionId: [null as number | null, Validators.required], // added Validators.required
    month: [
      new Date().getMonth() + 1,
      [Validators.required, Validators.min(1), Validators.max(12)],
    ],
    year: [new Date().getFullYear(), [Validators.required]],
  });

  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.loadMetadata();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadMetadata() {
    this.loadingMeta.set(true);
    this.academics.getClassSections().subscribe({
      next: (res) => { this.classSections.set(res.classSections ?? []); },
      error: () => { this.toast.error('Failed to load class sections'); },
      complete: () => { this.loadingMeta.set(false); },
    });
  }

  generateReport() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill in the required fields (Month & Year)');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.hasGenerated.set(true);

    const fv = this.form.value;
    this.attendance
      .getReport({
        classSectionId: fv.classSectionId ?? undefined,
        // studentId: fv.studentId ?? undefined,
        month: fv.month!,
        year: fv.year!,
      })
      .subscribe({
        next: (res) => {
          this.report.set(res.report ?? []);
          if (!res.report?.length) {
            this.toast.info('No attendance data found for the selected filters');
          }
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to generate report');
          this.toast.error(this.error()!);
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  clearFilters() {
    this.form.reset({
      classSectionId: null,
      // studentId: null,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    });
    this.report.set([]);
    this.hasGenerated.set(false);
    this.error.set(null);
    this.toast.info('Filters cleared');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getMonthName(month: number): string {
    return this.monthNames[month - 1] ?? 'Unknown';
  }

  getPctColor(pct: number): string {
    if (pct >= 75) return 'primary';
    if (pct >= 60) return 'accent';
    return 'warn';
  }

  getPctClass(pct: number): string {
    if (pct >= 75) return 'pct-good';
    if (pct >= 60) return 'pct-warn';
    return 'pct-bad';
  }

  getRowClass(row: AttendanceReportItem): string {
    if (row.attendancePercentage < 60) return 'row-critical';
    if (row.attendancePercentage < 75) return 'row-at-risk';
    return '';
  }

  // ── Sorting ───────────────────────────────────────────────────────────────

  sortData(event: Sort) {
    const data = this.report().slice();
    if (!event.active || event.direction === '') {
      this.report.set(data);
      return;
    }
    data.sort((a, b) => {
      const isAsc = event.direction === 'asc';
      switch (event.active) {
        case 'studentName':
          return compare(a.studentName, b.studentName, isAsc);
        case 'totalMarkedDays':
          return compare(a.totalMarkedDays, b.totalMarkedDays, isAsc);
        case 'present':
          return compare(a.present, b.present, isAsc);
        case 'absent':
          return compare(a.absent, b.absent, isAsc);
        case 'late':
          return compare(a.late, b.late, isAsc);
        case 'halfDay':
          return compare(a.halfDay, b.halfDay, isAsc);
        case 'attendancePercentage':
          return compare(a.attendancePercentage, b.attendancePercentage, isAsc);
        default:
          return 0;
      }
    });
    this.report.set(data);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportCSV() {
    const data = this.report();
    if (!data.length) return this.toast.warning('No data to export');

    const monthLabel = this.getMonthName(this.form.value.month!);
    const year = this.form.value.year;
    const section = this.selectedSectionLabel();

    const csv = [
      [`Attendance Report — ${monthLabel} ${year}`],
      [
        `Section: ${section}`,
        `Average: ${this.averageAttendance()}%`,
        `Above 75%: ${this.aboveThreshold()}`,
        `Below 75%: ${this.belowThreshold()}`,
      ],
      [],
      ['#', 'Student Name', 'Total Days', 'Present', 'Absent', 'Late', 'Half Day', 'Attendance %'],
      ...data.map((r, i) => [
        i + 1,
        `"${r.studentName}"`,
        r.totalMarkedDays,
        r.present,
        r.absent,
        r.late,
        r.halfDay,
        `${r.attendancePercentage.toFixed(1)}%`,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${monthLabel}-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('Exported as CSV');
  }

  exportPDF() {
    const data = this.report();
    if (!data.length) return this.toast.warning('No data to export');

    const monthLabel = this.getMonthName(this.form.value.month!);
    const year = this.form.value.year;
    const section = this.selectedSectionLabel();

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Report', 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthLabel} ${year}  ·  ${section}`, 14, 30);
    doc.text(
      `Average: ${this.averageAttendance()}%  ·  Above 75%: ${this.aboveThreshold()}  ·  Below 75%: ${this.belowThreshold()}`,
      14,
      38
    );

    (doc as any).autoTable({
      startY: 46,
      head: [['#', 'Student', 'Total', 'Present', 'Absent', 'Late', 'Half Day', '%']],
      body: data.map((r, i) => [
        i + 1,
        r.studentName,
        r.totalMarkedDays,
        r.present,
        r.absent,
        r.late,
        r.halfDay,
        `${r.attendancePercentage.toFixed(1)}%`,
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data: any) => {
        if (data.column.index === 7 && data.section === 'body') {
          const pct = parseFloat(data.cell.text[0]);
          if (pct < 60) data.cell.styles.textColor = [239, 68, 68];
          else if (pct < 75) data.cell.styles.textColor = [245, 158, 11];
          else data.cell.styles.textColor = [34, 197, 94];
        }
      },
    });

    doc.save(`attendance-${monthLabel}-${year}.pdf`);
    this.toast.success('Exported as PDF');
  }
}

function compare(a: string | number, b: string | number, isAsc: boolean): number {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
