// features/school/fees/fee-report/fee-report.ts
import {
  Component,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { FeeStatusBadge } from '../../../../../shared/components/fee-status-badge/fee-status-badge';
import { FeeReportRow, FeesService } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { RecordPaymentComponent } from '../../payments/record-payment/record-payment';
import { ConcessionsFormComponent } from '../../fee-concessions/concessions-form/concessions-form';


@Component({
  selector: 'app-fee-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatSnackBarModule,
    PaisePipe,
    // FeeStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-report.html',
  styleUrl: './fee-report.scss',
})
export class FeeReport implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  report = signal<FeeReportRow[]>([]);

  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);

  selectedClassSectionId = signal<number | null>(null);
  selectedAcademicYearId = signal<number | null>(null);
  overdueOnly = signal(false);
  searchQuery = signal('');

  expandedRows = signal<Set<number>>(new Set());

  filteredReport = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.report();
    return this.report().filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        (r.rollNumber ?? '').toLowerCase().includes(q)
    );
  });

  summaryStats = computed(() => {
    const rows = this.filteredReport();
    return {
      totalStudents: rows.length,
      totalDue: rows.reduce((s, r) => s + r.totalDue + r.customFeeEffective, 0),
      totalCollected: rows.reduce((s, r) => s + r.totalPaid + r.customFeePaid, 0),
      totalOutstanding: rows.reduce(
        (s, r) => s + r.balance + r.customFeeBalance,
        0
      ),
      totalConcessions: rows.reduce(
        (s, r) => s + r.totalConcession + r.customFeeConcession,
        0
      ),
    };
  });

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDropdowns();
  }

  loadDropdowns(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years);
        const current = res.years.find((y) => y.isCurrent);
        if (current) this.selectedAcademicYearId.set(current.id);
      },
    });
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
  }

  loadReport(): void {
    const csId = this.selectedClassSectionId();
    if (!csId) return;

    this.loading.set(true);
    this.error.set(null);
    this.report.set([]);

    this.fees
      .getFeeReport(
        csId,
        this.selectedAcademicYearId() ?? undefined,
        this.overdueOnly()
      )
      .subscribe({
        next: (rows) => {
          this.report.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load fee report');
          this.loading.set(false);
        },
      });
  }

  onClassSectionChange(id: number): void {
    this.selectedClassSectionId.set(id);
    this.loadReport();
  }

  onYearChange(): void {
    if (this.selectedClassSectionId()) this.loadReport();
  }

  onOverdueToggle(): void {
    if (this.selectedClassSectionId()) this.loadReport();
  }

  toggleRowExpand(enrollmentId: number): void {
    const set = new Set(this.expandedRows());
    if (set.has(enrollmentId)) set.delete(enrollmentId);
    else set.add(enrollmentId);
    this.expandedRows.set(set);
  }

  isExpanded(enrollmentId: number): boolean {
    return this.expandedRows().has(enrollmentId);
  }

  openRecordPayment(row: FeeReportRow): void {
    const cs = this.classSections().find(
      (c) => c.id === this.selectedClassSectionId()
    );
    const ref = this.dialog.open(RecordPaymentComponent, {
      width: '780px',
      maxWidth: '96vw',
      panelClass: 'payment-dialog',
      data: {
        enrollmentId: row.enrollmentId,
        studentName: row.studentName,
        className: row.className,
        sectionName: row.sectionName,
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.snack.open(
          `Payment recorded — ${result.meta?.receiptNumbers?.join(', ') ?? ''}`,
          'Close',
          { duration: 4000, panelClass: 'success-toast' }
        );
        this.loadReport();
      }
    });
  }

  openAddConcession(row: FeeReportRow): void {
    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: { enrollmentId: row.enrollmentId, studentName: row.studentName },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.snack.open('Concession granted', 'Close', { duration: 3000 });
        this.loadReport();
      }
    });
  }

  exportCsv(): void {
    const rows = this.filteredReport();
    if (!rows.length) return;

    const headers = [
      'Roll No',
      'Student Name',
      'Class',
      'Section',
      'Standard Fee Due',
      'Standard Fee Paid',
      'Standard Balance',
      'Custom Fee Due',
      'Custom Fee Paid',
      'Custom Balance',
      'Total Concession',
      'Overall Balance',
    ];

    const csvRows = rows.map((r) => [
      r.rollNumber ?? '',
      r.studentName,
      r.className,
      r.sectionName,
      (r.totalDue / 100).toFixed(2),
      (r.totalPaid / 100).toFixed(2),
      (r.balance / 100).toFixed(2),
      (r.customFeeEffective / 100).toFixed(2),
      (r.customFeePaid / 100).toFixed(2),
      (r.customFeeBalance / 100).toFixed(2),
      ((r.totalConcession + r.customFeeConcession) / 100).toFixed(2),
      ((r.balance + r.customFeeBalance) / 100).toFixed(2),
    ]);

    const csv = [headers, ...csvRows]
      .map((r) => r.map((v) => `"${v}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fee-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  overallBalance(row: FeeReportRow): number {
    return row.balance + row.customFeeBalance;
  }

  isOverdue(row: FeeReportRow): boolean {
    return this.overallBalance(row) > 0;
  }

  isPaid(row: FeeReportRow): boolean {
    return this.overallBalance(row) <= 0;
  }

  trackById(_: number, item: FeeReportRow): number {
    return item.enrollmentId;
  }
}