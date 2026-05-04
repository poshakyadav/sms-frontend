// student-ledger.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FeesService,
  FeeStructure,
  LedgerPayment,
  StudentLedger,
} from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-student-ledger',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './student-ledger.html',
  styleUrl: './student-ledger.scss',
})
export class StudentLedgerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private feesService = inject(FeesService);
  private toast = inject(ToastService);

  studentId = signal<number>(0);
  ledgers = signal<StudentLedger[]>([]);
  activeLedgerIndex = signal<number>(0);

  loading = signal(true);
  error = signal<string | null>(null);

  // ── Active ledger (currently selected year) ─────────────────────────────
  activeLedger = computed(() => {
    const all = this.ledgers();
    return all.length > 0 ? all[this.activeLedgerIndex()] : null;
  });

  studentName = computed(() => this.activeLedger()?.studentName ?? 'Unknown Student');
  className = computed(() => this.activeLedger()?.className ?? '');
  sectionName = computed(() => this.activeLedger()?.sectionName ?? '');
  academicYearName = computed(() => this.activeLedger()?.academicYearName ?? '');

  collectionRate = computed(() => {
    const l = this.activeLedger();
    if (!l || l.totalDue === 0) return 100;
    return Math.min(100, Math.round((l.totalPaid / l.totalDue) * 100));
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('studentId');
    if (!id || isNaN(+id)) {
      this.error.set('Invalid Student ID');
      this.loading.set(false);
      return;
    }
    this.studentId.set(+id);
    this.loadLedger();
  }

  loadLedger() {
    this.loading.set(true);
    this.error.set(null);

    this.feesService.getStudentLedger(this.studentId()).subscribe({
      next: (res) => {
        if (res.ledger && res.ledger.length > 0) {
          this.ledgers.set(res.ledger);
          this.activeLedgerIndex.set(0);
        } else {
          this.error.set('No ledger data found for this student');
        }
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Failed to load ledger';
        this.error.set(msg);
        this.toast.error(msg);
        this.loading.set(false);
      },
    });
  }

  selectLedger(index: number) {
    this.activeLedgerIndex.set(index);
  }

  goBack() {
    this.router.navigate(['/school/fees/payments/record']);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  feeStatusClass(fee: FeeStructure): string {
    const paid = this.getPaidForFee(fee);
    const remaining = fee.amount - paid;
    if (remaining <= 0) return 'cleared';
    if (paid > 0) return 'partial';
    if (fee.dueDate && fee.dueDate < new Date().toISOString().split('T')[0]) return 'overdue';
    return 'pending';
  }

  feeStatusLabel(fee: FeeStructure): string {
    const paid = this.getPaidForFee(fee);
    const remaining = fee.amount - paid;
    if (remaining <= 0) return 'Cleared';
    if (paid > 0) return 'Partial';
    if (fee.dueDate && fee.dueDate < new Date().toISOString().split('T')[0]) return 'Overdue';
    return 'Pending';
  }

  /** Sum payments for a fee by matching feeType (the ledger join includes feeType, not feeStructureId) */
  getPaidForFee(fee: FeeStructure): number {
    const ledger = this.activeLedger();
    if (!ledger) return 0;
    return ledger.details.payments
      .filter((p: LedgerPayment) => p.feeType === fee.feeType)
      .reduce((sum: number, p: LedgerPayment) => sum + (p.amountPaid ?? 0), 0);
  }

  paidPercentForFee(fee: FeeStructure): number {
    if (fee.amount === 0) return 0;
    const paid = this.getPaidForFee(fee);
    return Math.min(100, Math.round((paid / fee.amount) * 100));
  }

  methodIcon(method: string): string {
    const map: Record<string, string> = {
      CASH: 'payments',
      CHECK: 'receipt_long',
      BANK_TRANSFER: 'account_balance',
    };
    return map[method] ?? 'payment';
  }

  methodLabel(method: string): string {
    const map: Record<string, string> = {
      CASH: 'Cash',
      CHECK: 'Cheque',
      BANK_TRANSFER: 'Bank Transfer',
    };
    return map[method] ?? method;
  }

  formatINR(amount: number): string {
    return (amount ?? 0).toLocaleString('en-IN');
  }
}
