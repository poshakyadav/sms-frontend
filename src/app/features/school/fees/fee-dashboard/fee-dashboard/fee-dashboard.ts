import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import {
  FeesBreakdownItem,
  FeesDashboard,
  FeesService,
  FeesTrendItem,
} from '../../../../../core/services/fees.service';
import {
  AcademicsService,
  AcademicYear,
  ClassSection,
} from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { Router } from '@angular/router';
import { FeesTrendChart } from '../fees-trend-chart/fees-trend-chart';

@Component({
  selector: 'app-fee-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDividerModule,
    FeesTrendChart,
  ],
  templateUrl: './fee-dashboard.html',
  styleUrl: './fee-dashboard.scss',
})
export class FeeDashboard implements OnInit {
  private feesService = inject(FeesService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);
  private router = inject(Router);

  academicYears = signal<AcademicYear[]>([]);
  classSections = signal<ClassSection[]>([]);

  dashboard = signal<FeesDashboard | null>(null);
  trend = signal<FeesTrendItem[]>([]);
  breakdown = signal<FeesBreakdownItem[]>([]);

  selectedAcademicYearId = signal<number | null>(null);
  selectedClassSectionId = signal<number | null>(null);

  loading = signal(true);
  trendLoading = signal(false);
  breakdownLoading = signal(false);
  error = signal<string | null>(null);

  // Computed label for the active filter
  activeYearLabel = computed(() => {
    const id = this.selectedAcademicYearId();
    if (!id) return 'All Academic Years';
    const year = this.academicYears().find((y) => y.id === id);
    return year ? year.name : 'All Academic Years';
  });

  activeSectionLabel = computed(() => {
    const id = this.selectedClassSectionId();
    if (!id) return 'All Class-Sections';
    const cs = this.classSections().find((c) => c.id === id);
    return cs ? `${cs.className} - ${cs.sectionName}` : 'All Class-Sections';
  });

  readonly breakdownColumns = ['classSection', 'assigned', 'collected', 'outstanding', 'rate'];

  ngOnInit() {
    this.loadOptions();
    this.loadDashboard();
  }

  private loadOptions() {
    this.academicsService.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years || []);
        const current = res.years.find((y) => y.isCurrent);
        if (current) this.selectedAcademicYearId.set(current.id);
      },
      error: () => {
        // Non-critical — filters just won't be pre-selected
      },
    });

    this.academicsService.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections || []),
      error: () => {},
    });
  }

  loadDashboard() {
    this.loading.set(true);
    this.error.set(null);

    this.feesService
      .getFeesDashboard(
        this.selectedAcademicYearId() || undefined,
        this.selectedClassSectionId() || undefined
      )
      .subscribe({
        next: (res) => {
          this.dashboard.set(res.dashboard);
          this.loading.set(false);
          this.loadTrendAndBreakdown();
        },
        error: (err) => {
          this.error.set(err?.error?.error || err.message || 'Failed to load dashboard');
          this.toast.error(this.error()!);
          this.loading.set(false);
        },
      });
  }

  private loadTrendAndBreakdown() {
    this.trendLoading.set(true);
    this.breakdownLoading.set(true);

    this.feesService
      .getFeesCollectionTrend(
        this.selectedAcademicYearId() || undefined,
        this.selectedClassSectionId() || undefined
      )
      .subscribe({
        next: (res) => {
          this.trend.set(res.trend || []);
          this.trendLoading.set(false);
        },
        error: () => {
          this.trend.set([]);
          this.trendLoading.set(false);
        },
      });

    this.feesService
      .getFeesClassSectionBreakdown(
        this.selectedAcademicYearId() || undefined,
        this.selectedClassSectionId() || undefined
      )
      .subscribe({
        next: (res) => {
          this.breakdown.set(res.breakdown || []);
          this.breakdownLoading.set(false);
        },
        error: () => {
          this.breakdown.set([]);
          this.breakdownLoading.set(false);
        },
      });
  }

  onFilterChange() {
    this.loadDashboard();
  }

  clearFilters() {
    this.selectedAcademicYearId.set(null);
    this.selectedClassSectionId.set(null);
    this.loadDashboard();
  }

  getCollectionRate(item: FeesBreakdownItem): number {
    if (!item.totalAssigned || item.totalAssigned <= 0) return 0;
    return Math.round((item.totalCollected / item.totalAssigned) * 100);
  }

  getOutstanding(item: FeesBreakdownItem): number {
    return Math.max(0, item.totalAssigned - item.totalCollected);
  }

  getRateClass(rate: number): string {
    if (rate >= 80) return 'rate-high';
    if (rate >= 50) return 'rate-mid';
    return 'rate-low';
  }

  formatAmount(amount: number): string {
    if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
    return `₹${amount}`;
  }

  quickRecordPayment() {
    this.router.navigate(['/school/fees/payments/record']);
  }

  quickViewReport() {
    this.router.navigate(['/school/fees/report']);
  }

  quickViewStructures() {
    this.router.navigate(['/school/fees/structures']);
  }
}
