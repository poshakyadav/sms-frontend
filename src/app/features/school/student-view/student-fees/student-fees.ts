import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// ── Interfaces (mirrors backend) ───────────────────────────────────────────

export interface StudentFeeItem {
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

export interface StudentPaymentItem {
  id: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
  receiptNumber: string;
  feeType: string;
  notes: string | null;
}

export interface StudentFeeOverview {
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
}

@Component({
  selector: 'app-student-fees',
  imports: [CommonModule, RouterModule],
  templateUrl: './student-fees.html',
  styleUrl: './student-fees.scss',
})
export class StudentFees implements OnInit {
  private api = inject(ApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overviews = signal<StudentFeeOverview[]>([]);

  ngOnInit() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<{ success: boolean; overview: StudentFeeOverview[] }>('school/fees/student/my-fees')
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
