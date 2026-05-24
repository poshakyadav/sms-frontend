// features/school/fees/student-fees/student-fees.ts
import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FeesService,
  StudentFeeOverview,
  StudentFeeItem,
  StudentPaymentItem,
  FeeStatus,
} from '../../../../core/services/fees.service';

import { FeeStatusBadge } from '../../../../shared/components/fee-status-badge/fee-status-badge';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';

@Component({
  selector: 'app-student-fees',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PaisePipe,
    FeeStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-fees.html',
  styleUrl: './student-fees.scss',
})
export class StudentFees implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  overviews = signal<StudentFeeOverview[]>([]);

  // Active tab: index into overviews array
  activeYearIndex = signal(0);

  // Section expand state per year (key: yearId, value: 'STRUCTURE' | 'ASSIGNMENT' | 'PAYMENTS')
  expandedSections = signal<Map<number, Set<string>>>(new Map());

  activeOverview = computed(() => {
    const list = this.overviews();
    if (!list.length) return null;
    const idx = this.activeYearIndex();
    return list[Math.min(idx, list.length - 1)];
  });

  structureFees = computed(() => {
    const o = this.activeOverview();
    if (!o) return [];
    return o.feeBreakdown.filter((f) => f.source === 'STRUCTURE');
  });

  assignmentFees = computed(() => {
    const o = this.activeOverview();
    if (!o) return [];
    return o.feeBreakdown.filter((f) => f.source === 'ASSIGNMENT');
  });

  collectionRateAngle = computed(() => {
    const o = this.activeOverview();
    if (!o) return 0;
    return Math.min(360, (o.collectionRate / 100) * 360);
  });

  constructor(private fees: FeesService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getStudentOwnFees().subscribe({
      next: (data) => {
        this.overviews.set(data);
        this.loading.set(false);
        // Default expand structures and payments for active year
        if (data.length > 0) {
          this.expandSection(data[0].academicYearId, 'STRUCTURE');
          this.expandSection(data[0].academicYearId, 'PAYMENTS');
        }
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load your fee details');
        this.loading.set(false);
      },
    });
  }

  selectYear(index: number): void {
    this.activeYearIndex.set(index);
    const o = this.overviews()[index];
    if (o && !this.expandedSections().has(o.academicYearId)) {
      this.expandSection(o.academicYearId, 'STRUCTURE');
      this.expandSection(o.academicYearId, 'PAYMENTS');
    }
  }

  expandSection(yearId: number, section: string): void {
    const map = new Map(this.expandedSections());
    if (!map.has(yearId)) map.set(yearId, new Set());
    map.get(yearId)!.add(section);
    this.expandedSections.set(map);
  }

  toggleSection(yearId: number, section: string): void {
    const map = new Map(this.expandedSections());
    if (!map.has(yearId)) map.set(yearId, new Set());
    const set = map.get(yearId)!;
    if (set.has(section)) set.delete(section);
    else set.add(section);
    this.expandedSections.set(map);
  }

  isSectionExpanded(yearId: number, section: string): boolean {
    return this.expandedSections().get(yearId)?.has(section) ?? false;
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  isOverdue(item: StudentFeeItem): boolean {
    return item.status === 'OVERDUE';
  }

  // Donut chart SVG helpers
  getDonutPath(rate: number): string {
    if (rate <= 0) return '';
    const r = 40;
    const cx = 50,
      cy = 50;
    const angle = (rate / 100) * 360;
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;
  }

  trackByFee(_: number, item: StudentFeeItem): number {
    return item.id;
  }
  trackByPayment(_: number, item: StudentPaymentItem): number {
    return item.id;
  }
}
