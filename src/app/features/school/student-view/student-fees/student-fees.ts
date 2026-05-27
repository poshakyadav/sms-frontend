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
} from '../../../../core/services/fees.service';

import { FeeStatusBadge } from '../../../../shared/components/fee-status-badge/fee-status-badge';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';

// ── Month group shape ─────────────────────────────────────────────────────────
// Each group holds all fee items that share the same feeMonth value.
// Items with feeMonth === null are collected into a single trailing group.
export interface FeeMonthGroup {
  /** Raw "YYYY-MM" key used for tracking; null for one-time fees */
  monthKey: string | null;
  /** Human-readable label shown in the table header row, e.g. "April 2025" */
  label: string;
  /** All fee items belonging to this month */
  items: StudentFeeItem[];
}

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

  // Section expand state per year (key: yearId, value: Set of open section keys)
  expandedSections = signal<Map<number, Set<string>>>(new Map());

  // ── Base selectors ─────────────────────────────────────────────────────────

  activeOverview = computed(() => {
    const list = this.overviews();
    if (!list.length) return null;
    const idx = this.activeYearIndex();
    return list[Math.min(idx, list.length - 1)];
  });

  // ── Flat fee lists (unchanged — still needed for counts etc.) ──────────────

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

  // ── Grouped fee lists (used by the table templates) ───────────────────────

  /**
   * Groups standard (STRUCTURE) fees by feeMonth.
   *
   * The backend already returns items sorted by feeMonth → feeType, so we
   * iterate once and collect consecutive items with the same key — O(n),
   * no sort needed. Items with feeMonth === null are appended as a single
   * "One-time fees" group at the end.
   */
  structureFeeGroups = computed<FeeMonthGroup[]>(() => this.buildMonthGroups(this.structureFees()));

  /**
   * Groups custom (ASSIGNMENT) fees by feeMonth.
   * Same logic as structureFeeGroups.
   */
  assignmentFeeGroups = computed<FeeMonthGroup[]>(() =>
    this.buildMonthGroups(this.assignmentFees())
  );

  // ── Donut helper ───────────────────────────────────────────────────────────

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

  // ── Formatting helpers ─────────────────────────────────────────────────────

  /**
   * Converts "YYYY-MM" to a full month label, e.g. "April 2025".
   * Returns "—" for null/empty.
   */
  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = [
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
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  /**
   * Short month label for table cells, e.g. "Apr 2025".
   */
  formatMonthShort(feeMonth: string | null): string {
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

  // ── Donut chart SVG helper ─────────────────────────────────────────────────

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

  // ── TrackBy functions ──────────────────────────────────────────────────────

  trackByFee(_: number, item: StudentFeeItem): number {
    return item.id;
  }

  trackByPayment(_: number, item: StudentPaymentItem): number {
    return item.id;
  }

  trackByGroup(_: number, group: FeeMonthGroup): string {
    return group.monthKey ?? '__one_time__';
  }

  // ── Private: month-grouping logic ─────────────────────────────────────────

  /**
   * Builds an ordered array of FeeMonthGroup from a flat fee list.
   *
   * Contract:
   * - Items arrive pre-sorted by feeMonth (ASC, nulls last) from the backend.
   * - Items with the same feeMonth are placed in the same group.
   * - Items with feeMonth === null form a trailing "One-time fees" group.
   * - An empty input list returns an empty array.
   *
   * This is a pure function — no side-effects, safe to call inside computed().
   */
  private buildMonthGroups(fees: StudentFeeItem[]): FeeMonthGroup[] {
    if (!fees.length) return [];

    const groups: FeeMonthGroup[] = [];
    let currentKey: string | null | undefined = undefined; // undefined = not started
    let currentItems: StudentFeeItem[] = [];

    for (const fee of fees) {
      const key = fee.feeMonth; // "YYYY-MM" or null

      if (key !== currentKey) {
        // Flush the previous group (skip the very first iteration where currentKey is undefined)
        if (currentKey !== undefined) {
          groups.push({
            monthKey: currentKey,
            label: currentKey ? this.formatMonth(currentKey) : 'One-time fees',
            items: currentItems,
          });
        }
        currentKey = key;
        currentItems = [fee];
      } else {
        currentItems.push(fee);
      }
    }

    // Flush the last group
    if (currentKey !== undefined && currentItems.length > 0) {
      groups.push({
        monthKey: currentKey,
        label: currentKey ? this.formatMonth(currentKey) : 'One-time fees',
        items: currentItems,
      });
    }

    return groups;
  }
}
