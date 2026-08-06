// features/school/fees/parent-fees/parent-fees.ts
import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FeesService,
  ParentChildFeeOverview,
  StudentFeeItem,
  StudentPaymentItem,
} from '../../../../core/services/fees.service';

import { FeeStatusBadge } from '../../../../shared/components/fee-status-badge/fee-status-badge';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FeeReceiptDialogComponent } from '../../../../shared/components/fee-receipt-dialog/fee-receipt-dialog';

@Component({
  selector: 'app-parent-fees',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    PaisePipe,
    FeeStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-fees.html',
  styleUrl: './parent-fees.scss',
})
export class ParentFees implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  overviews = signal<ParentChildFeeOverview[]>([]);

  /** Active tab: index into overviews array */
  activeYearIndex = signal(0);

  /** Section expand state per year */
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

  hasNoChildSelected = signal(false);

  constructor(private fees: FeesService,  private dialog: MatDialog) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.hasNoChildSelected.set(false);

    this.fees.getParentChildFees().subscribe({
      next: (data) => {
        this.overviews.set(data);
        this.loading.set(false);
        if (data.length > 0) {
          this.expandSection(data[0].academicYearId, 'STRUCTURE');
          this.expandSection(data[0].academicYearId, 'PAYMENTS');
        }
      },
      error: (err) => {
        const msg: string = err?.error?.error ?? err?.message ?? '';
        if (msg.includes('No active child') || msg.includes('child') || err?.status === 400) {
          this.hasNoChildSelected.set(true);
        } else {
          this.error.set(msg || "Failed to load your child's fee details");
        }
        this.loading.set(false);
      },
    });
  }

  // ── Receipt dialog ─────────────────────────────────────────────────────────

/**
 * Opens the shared fee receipt dialog for a payment made toward the active
 * child. Ownership is enforced server-side via fees.parent.view + the
 * parent-child relationship check inside getFeeReceipt().
 */
openReceipt(payment: StudentPaymentItem): void {
  this.dialog.open(FeeReceiptDialogComponent, {
    width: '780px',
    maxWidth: '95vw',
    data: { paymentId: payment.id },
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
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // Donut chart SVG helper (shared with student-fees)
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
