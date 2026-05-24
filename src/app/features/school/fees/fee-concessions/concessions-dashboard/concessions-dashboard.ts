// features/school/fees/fee-concessions/concessions-dashboard/concessions-dashboard.ts
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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  FeesService,
  ConcessionDashboardRow,
} from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';

@Component({
  selector: 'app-concessions-dashboard',
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
    MatSlideToggleModule,
    MatSnackBarModule,
    PaisePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concessions-dashboard.html',
  styleUrl: './concessions-dashboard.scss',
})
export class ConcessionsDashboard implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  rows = signal<ConcessionDashboardRow[]>([]);
  totalConcessionAmount = signal(0);

  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);

  selectedAcademicYearId = signal<number | null>(null);
  selectedClassSectionId = signal<number | null>(null);
  activeOnly = signal(true);
  searchQuery = signal('');

  revoking = signal<number | null>(null);

  filteredRows = computed(() => {
    let list = this.rows();
    if (this.activeOnly()) list = list.filter((r) => r.isActive);
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.feeType.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }
    return list;
  });

  activeCount = computed(() => 
    this.filteredRows().filter(r => r.isActive).length
  );

  revokedCount = computed(() => 
    this.rows().filter(r => !r.isActive).length
  );

  activeTotalAmount = computed(() =>
    this.filteredRows()
      .filter((r) => r.isActive)
      .reduce((s, r) => s + r.concessionAmount, 0)
  );

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
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
        this.loadData();
      },
    });
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees
      .getConcessionDashboard(
        this.selectedAcademicYearId() ?? undefined,
        this.selectedClassSectionId() ?? undefined
      )
      .subscribe({
        next: (res) => {
          this.rows.set(res.rows);
          this.totalConcessionAmount.set(res.totalConcessionAmount);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load concessions');
          this.loading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.loadData();
  }

  revoke(row: ConcessionDashboardRow): void {
    if (
      !confirm(
        `Revoke concession for ${row.studentName} — ${row.feeType}? This cannot be undone.`
      )
    )
      return;
    this.revoking.set(row.concessionId);
    this.fees.revokeConcession(row.concessionId).subscribe({
      next: () => {
        this.revoking.set(null);
        this.snack.open('Concession revoked', 'Close', { duration: 3000 });
        this.loadData();
      },
      error: (err) => {
        this.revoking.set(null);
        this.snack.open(
          err?.error?.error ?? 'Failed to revoke concession',
          'Close',
          { duration: 4000, panelClass: 'error-toast' }
        );
      },
    });
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec',
    ];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  formatConcessionLabel(row: ConcessionDashboardRow): string {
    if (row.concessionType === 'PERCENTAGE') {
      return `${row.concessionValue}%`;
    }
    return `₹${(row.concessionValue / 100).toLocaleString('en-IN')}`;
  }

  trackById(_: number, item: ConcessionDashboardRow): number {
    return item.concessionId;
  }
}