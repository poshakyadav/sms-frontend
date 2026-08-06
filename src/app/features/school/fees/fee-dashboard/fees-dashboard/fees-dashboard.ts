// features/school/fees/fees-dashboard/fees-dashboard.ts
import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { ClassSectionBreakdown, CollectionTrendPoint, FeesDashboard, FeesService } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';


@Component({
  selector: 'app-fees-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatTabsModule,
    PaisePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fees-dashboard.html',
  styleUrl: './fees-dashboard.scss',
})
export class FeesDashboardComponent implements OnInit {
  // Loading states
  loadingDashboard = signal(false);
  loadingTrend = signal(false);
  loadingBreakdown = signal(false);

  // Error states
  errorDashboard = signal<string | null>(null);
  errorTrend = signal<string | null>(null);

  // Data
  dashboard = signal<FeesDashboard | null>(null);
  trend = signal<CollectionTrendPoint[]>([]);
  breakdown = signal<ClassSectionBreakdown[]>([]);

  // Filters
  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);
  selectedAcademicYearId = signal<number | null>(null);
  selectedClassSectionId = signal<number | null>(null);

  // Chart state
  maxTrendAmount = computed(() => {
    const points = this.trend();
    if (!points.length) return 1;
    return Math.max(...points.map((p) => p.amount), 1);
  });

  collectionRateDisplay = computed(() => {
    const d = this.dashboard();
    if (!d) return 0;
    return d.collectionRate;
  });

  grandTotal = computed(() => {
    const d = this.dashboard();
    if (!d) return { assigned: 0, collected: 0, outstanding: 0 };
    return {
      assigned: d.grandTotalAssigned,
      collected: d.grandTotalCollected,
      outstanding: d.grandTotalOutstanding,
    };
  });

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadDropdowns();
  }

  loadDropdowns(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years);
        const current = res.years.find((y) => y.isCurrent);
        if (current) {
          this.selectedAcademicYearId.set(current.id);
        }
        this.loadAllData();
      },
    });
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
  }

  loadAllData(): void {
    this.loadDashboard();
    this.loadTrend();
    this.loadBreakdown();
  }

  loadDashboard(): void {
    this.loadingDashboard.set(true);
    this.errorDashboard.set(null);
    this.fees
      .getFeesDashboard(
        this.selectedAcademicYearId() ?? undefined,
        this.selectedClassSectionId() ?? undefined
      )
      .subscribe({
        next: (d) => {
          this.dashboard.set(d);
          this.loadingDashboard.set(false);
        },
        error: (err) => {
          this.errorDashboard.set(err?.error?.error ?? 'Failed to load dashboard');
          this.loadingDashboard.set(false);
        },
      });
  }

  loadTrend(): void {
    this.loadingTrend.set(true);
    this.fees
      .getCollectionTrend(
        this.selectedAcademicYearId() ?? undefined,
        this.selectedClassSectionId() ?? undefined
      )
      .subscribe({
        next: (t) => {
          this.trend.set(t);
          this.loadingTrend.set(false);
        },
        error: () => this.loadingTrend.set(false),
      });
  }

  loadBreakdown(): void {
    this.loadingBreakdown.set(true);
    this.fees
      .getClassSectionBreakdown(
        this.selectedAcademicYearId() ?? undefined,
        this.selectedClassSectionId() ?? undefined
      )
      .subscribe({
        next: (b) => {
          this.breakdown.set(b);
          this.loadingBreakdown.set(false);
        },
        error: () => this.loadingBreakdown.set(false),
      });
  }

  onYearChange(id: number): void {
    this.selectedAcademicYearId.set(id);
    this.loadAllData();
  }

  onClassSectionChange(id: number | null): void {
    this.selectedClassSectionId.set(id);
    this.loadAllData();
  }

  navigateTo(path: string): void {
    this.router.navigate(['/school/fees/' + path]);
  }

  trendBarHeight(amount: number): number {
    const max = this.maxTrendAmount();
    return max > 0 ? Math.max(2, (amount / max) * 100) : 2;
  }

  formatTrendDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  breakdownCollectionRate(row: ClassSectionBreakdown): number {
    const assigned = this.combinedAssigned(row);
    if (assigned <= 0) return 100;
    return Math.round((this.combinedCollected(row) / assigned) * 100);
  }

  combinedAssigned(row: ClassSectionBreakdown): number {
    return row.totalAssigned + row.totalCustomAssigned;
  }

  combinedCollected(row: ClassSectionBreakdown): number {
    return row.totalCollected + row.totalCustomCollected;
  }

  combinedOutstanding(row: ClassSectionBreakdown): number {
    return this.combinedAssigned(row) - this.combinedCollected(row);
  }

  navigateToReport(row: ClassSectionBreakdown): void {
    this.router.navigate(['/school/fees/report'], {
      queryParams: { classSectionId: row.classSectionId },
    });
  }
  
}
