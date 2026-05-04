import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ParentService } from '../../../../core/services/parent.service';
import { Subject, takeUntil } from 'rxjs';

// ── Interfaces ─────────────────────────────────────────────────────────────

interface StudentFeeItem {
  id: number;
  feeType: string;
  amount: number;
  dueDate: string | null;
  isMandatory: boolean;
  description: string | null;
  amountPaid: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
}

interface StudentPaymentItem {
  id: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
  receiptNumber: string;
  feeType: string;
  notes: string | null;
}

interface ParentChildFeeOverview {
  academicYearId: number;
  academicYearName: string;
  className: string;
  sectionName: string;
  rollNumber: string | null;
  totalDue: number;
  totalPaid: number;
  balance: number;
  collectionRate: number;
  feeBreakdown: StudentFeeItem[];
  recentPayments: StudentPaymentItem[];
  studentName: string;
  studentEmail: string;
  studentId: number;
}

@Component({
  selector: 'app-parent-fees',
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-fees.html',
  styleUrl: './parent-fees.scss',
})
export class ParentFees implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private parentService = inject(ParentService);
  private destroy$ = new Subject<void>();

  readonly Math = Math; // expose to template

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overviews = signal<ParentChildFeeOverview[]>([]);
  readonly selectedYearIdx = signal(0);
  readonly hasActiveChild = signal(false);

  constructor() {
    // React to child selection changes
    effect(() => {
      const childId = this.parentService.activeChildId();
      this.hasActiveChild.set(childId !== null);
      if (childId !== null) {
        this.load();
      }
    });
  }

  ngOnInit(): void {
    const childId = this.parentService.activeChildId();
    this.hasActiveChild.set(childId !== null);
    if (childId !== null) {
      this.load();
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedYearIdx.set(0);

    this.api
      .get<{ success: boolean; overview: ParentChildFeeOverview[] }>(
        'school/fees/parent/child-fees'
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.overviews.set(res.overview ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Unable to load fee details. Please try again.');
          this.loading.set(false);
        },
      });
  }

  selectYear(idx: number): void {
    this.selectedYearIdx.set(idx);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getDashOffset(pct: number): number {
    // Circumference = 2π × 32 ≈ 201.06
    const circumference = 201.06;
    return circumference - (circumference * pct) / 100;
  }

  formatCurrency(amount: number): string {
    return '₹' + amount.toLocaleString('en-IN');
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatFeeType(feeType: string): string {
    return feeType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatMethod(method: string): string {
    const map: Record<string, string> = {
      CASH: 'Cash',
      CHECK: 'Cheque',
      BANK_TRANSFER: 'Bank Transfer',
    };
    return map[method] ?? method;
  }

  isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return dueDate < new Date().toISOString().split('T')[0];
  }
}
