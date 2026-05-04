// fee-report.ts  — full replacement

import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import {
  AcademicsService,
  AcademicYear,
  ClassSection,
} from '../../../../../core/services/academics.service';
import { FeeReportItem, FeesService } from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-fee-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './fee-report.html',
  styleUrl: './fee-report.scss',
})
export class FeeReport implements OnInit {
  private feesService = inject(FeesService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // ── Filter state ────────────────────────────────────────────────────────────
  classSections = signal<ClassSection[]>([]);
  academicYears = signal<AcademicYear[]>([]);

  selectedClassSectionId = signal<number | null>(null);
  selectedAcademicYearId = signal<number | null>(null);
  overdueOnly = signal(false);

  // ── Data state ──────────────────────────────────────────────────────────────
  report = signal<FeeReportItem[]>([]);

  // ── Loading / error ─────────────────────────────────────────────────────────
  filtersLoading = signal(true);
  reportLoading = signal(false);
  error = signal<string | null>(null);

  /** True once the user has triggered at least one report load */
  hasQueried = signal(false);

  // ── Table columns ───────────────────────────────────────────────────────────
  displayedColumns = [
    'rollNumber',
    'studentName',
    'classSection',
    'totalDue',
    'totalPaid',
    'balance',
    'status',
    'actions',
  ];

  // ── Computed summary totals ─────────────────────────────────────────────────
  totalDue = computed(() => this.report().reduce((s, r) => s + r.totalDue, 0));
  totalPaid = computed(() => this.report().reduce((s, r) => s + r.totalPaid, 0));
  totalBalance = computed(() => this.report().reduce((s, r) => s + r.balance, 0));
  overdueCount = computed(() => this.report().filter((r) => r.balance > 0).length);
  paidCount = computed(() => this.report().filter((r) => r.balance <= 0).length);

  collectionRate = computed(() => {
    const due = this.totalDue();
    return due > 0 ? Math.round((this.totalPaid() / due) * 100) : 0;
  });

  selectedClassSectionLabel = computed(() => {
    const id = this.selectedClassSectionId();
    if (!id) return null;
    const cs = this.classSections().find((c) => c.id === id);
    return cs ? `${cs.className} – ${cs.sectionName}` : null;
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadFilters();
  }

  private loadFilters() {
    this.filtersLoading.set(true);

    // Load both class-sections and academic years in parallel
    let sectionsLoaded = false;
    let yearsLoaded = false;
    const checkDone = () => {
      if (sectionsLoaded && yearsLoaded) this.filtersLoading.set(false);
    };

    this.academicsService.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections ?? []);
        sectionsLoaded = true;
        checkDone();
      },
      error: () => {
        sectionsLoaded = true;
        checkDone();
      },
    });

    this.academicsService.getAcademicYears().subscribe({
      next: (res) => {
        const years = res.years ?? [];
        this.academicYears.set(years);
        // Pre-select current year if available
        const current = years.find((y) => y.isCurrent);
        if (current) this.selectedAcademicYearId.set(current.id);
        yearsLoaded = true;
        checkDone();
      },
      error: () => {
        yearsLoaded = true;
        checkDone();
      },
    });
  }

  // ── Report loading ──────────────────────────────────────────────────────────

  loadReport() {
    const csId = this.selectedClassSectionId();
    if (!csId) {
      this.toast.error('Please select a class-section first.');
      return;
    }

    this.hasQueried.set(true);
    this.reportLoading.set(true);
    this.error.set(null);

    this.feesService
      .getFeeReport(csId, this.selectedAcademicYearId() ?? undefined, this.overdueOnly())
      .subscribe({
        next: (res) => {
          this.report.set(res.report ?? []);
          this.reportLoading.set(false);
        },
        error: (err) => {
          const msg = err?.error?.error ?? err?.message ?? 'Failed to load fee report.';
          this.error.set(msg);
          this.toast.error(msg);
          this.reportLoading.set(false);
        },
      });
  }

  // ── Filter change handlers ──────────────────────────────────────────────────

  onClassSectionChange(value: number | null) {
    this.selectedClassSectionId.set(value);
    // Auto-load when class-section changes (if it has a value)
    if (value) this.loadReport();
    else this.report.set([]);
  }

  onAcademicYearChange(value: number | null) {
    this.selectedAcademicYearId.set(value);
    if (this.selectedClassSectionId()) this.loadReport();
  }

  onOverdueToggle(value: boolean) {
    this.overdueOnly.set(value);
    if (this.selectedClassSectionId()) this.loadReport();
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  viewLedger(studentId: number) {
    this.router.navigate(['/school/fees/ledger', studentId]);
  }

  viewPaymentHistory(enrollmentId: number) {
    this.router.navigate(['/school/fees/payments-history', enrollmentId]);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getStatus(balance: number): 'Paid' | 'Partial' | 'Due' {
    if (balance <= 0) return 'Paid';
    return 'Due';
  }

  getStatusClass(balance: number): string {
    if (balance <= 0) return 'paid';
    return 'due';
  }
}
