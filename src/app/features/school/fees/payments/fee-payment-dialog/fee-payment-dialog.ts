// fee-payment-dialog.ts — FIXED
// Changes:
// 1. allFees signal holds ALL fees (including cleared) — shown in breakdown
// 2. dueFees computed = allFees filtered to remaining > 0 — used for payment logic
// 3. "Pay All" now builds a distributed payments[] array matching per-fee remainders
//    so backend validation passes (no single fee gets more than its remaining)
// 4. Form amount validator uses totalDue (sum of all remaining) as max
// 5. On submit for "Pay All", distributes entered amount proportionally across fees

import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DueFee, EnrolledStudent, FeesService } from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';

// ── Payment mode ────────────────────────────────────────────────────────────
export type PaymentMode = 'all' | 'single';

// ── Max-amount validator factory ─────────────────────────────────────────────
function maxAmountValidator(getMax: () => number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = Number(control.value);
    const max = getMax();
    if (!control.value && control.value !== 0) return null;
    if (isNaN(val) || val <= 0) return { min: true };
    if (val > max) return { maxExceeded: { max, actual: val } };
    return null;
  };
}

/**
 * Distribute a total payment amount across fee structures proportionally
 * (largest-remaining first) without exceeding any individual fee's remaining.
 *
 * Example: totalToDistribute=4500, fees=[{id:1,remaining:4000},{id:2,remaining:2000},{id:3,remaining:500}]
 * Result: [{feeStructureId:1,amountPaid:4000},{feeStructureId:2,amountPaid:500}]
 *
 * This ensures no single fee payment exceeds its remaining balance.
 */
function distributePayment(
  totalToDistribute: number,
  fees: DueFee[]
): Array<{ feeStructureId: number; amountPaid: number }> {
  // Sort by remaining descending — pay largest first
  const sorted = [...fees].sort((a, b) => b.remaining - a.remaining);
  const result: Array<{ feeStructureId: number; amountPaid: number }> = [];
  let remaining = totalToDistribute;

  for (const fee of sorted) {
    if (remaining <= 0) break;
    if (fee.remaining <= 0) continue;
    const toApply = Math.min(remaining, fee.remaining);
    if (toApply > 0) {
      result.push({ feeStructureId: fee.id, amountPaid: toApply });
      remaining -= toApply;
    }
  }

  return result;
}

@Component({
  selector: 'app-fee-payment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './fee-payment-dialog.html',
  styleUrl: './fee-payment-dialog.scss',
})
export class FeePaymentDialog implements OnInit {
  private feesService = inject(FeesService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  // ── Inputs ────────────────────────────────────────────────────────────────
  student = input.required<EnrolledStudent>();

  // ── Outputs ───────────────────────────────────────────────────────────────
  closed = output<void>();
  paymentRecorded = output<void>();

  // ── State ─────────────────────────────────────────────────────────────────
  /** ALL fee structures (including cleared ones) — shown in breakdown */
  allFees = signal<DueFee[]>([]);
  loading = signal(true);
  submitting = signal(false);
  paymentMode = signal<PaymentMode>('all');
  selectedFee = signal<DueFee | null>(null);
  animatingOut = signal(false);

  readonly paymentMethods = [
    { value: 'CASH', label: 'Cash', icon: 'payments' },
    { value: 'CHECK', label: 'Cheque', icon: 'receipt_long' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: 'account_balance' },
  ] as const;

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Only fees with remaining > 0 — used for payment operations */
  dueFees = computed(() => this.allFees().filter((f) => f.remaining > 0));

  totalFeeAmount = computed(() => this.allFees().reduce((s, f) => s + f.amount, 0));
  totalPaid = computed(() => this.allFees().reduce((s, f) => s + f.paid, 0));

  /** Total outstanding = sum of remaining across ALL pending fees */
  totalDue = computed(() => this.dueFees().reduce((s, f) => s + f.remaining, 0));

  maxPayable = computed(() => {
    if (this.paymentMode() === 'all') return this.totalDue();
    return this.selectedFee()?.remaining ?? 0;
  });

  // ── Form ──────────────────────────────────────────────────────────────────
  form = this.fb.group({
    amountPaid: [
      null as number | null,
      [Validators.required, Validators.min(1), maxAmountValidator(() => this.maxPayable())],
    ],
    paymentMethod: ['CASH' as 'CASH' | 'CHECK' | 'BANK_TRANSFER', Validators.required],
    notes: [''],
  });

  ngOnInit() {
    this.loadDueFees();
  }

  loadDueFees() {
    this.loading.set(true);
    this.feesService.getDueFeesForEnrollment(this.student().enrollmentId).subscribe({
      next: (res) => {
        // Store ALL fees (backend now returns cleared too)
        this.allFees.set(res.fees ?? []);
        this.loading.set(false);

        // Pre-select "pay all" mode if there are pending fees
        if (this.dueFees().length > 0) {
          this.setPayAllMode();
        }
      },
      error: () => {
        this.toast.error('Failed to load fee details');
        this.loading.set(false);
      },
    });
  }

  setPayAllMode() {
    this.paymentMode.set('all');
    this.selectedFee.set(null);
    this.form.patchValue({ amountPaid: this.totalDue() });
    this.form.get('amountPaid')?.updateValueAndValidity();
  }

  selectSingleFee(fee: DueFee) {
    if (fee.remaining <= 0) return; // Cannot pay a cleared fee
    this.paymentMode.set('single');
    this.selectedFee.set(fee);
    this.form.patchValue({ amountPaid: fee.remaining });
    this.form.get('amountPaid')?.updateValueAndValidity();
  }

  onAmountInput() {
    this.form.get('amountPaid')?.updateValueAndValidity();
  }

  get amountControl() {
    return this.form.get('amountPaid')!;
  }

  get amountErrors() {
    const ctrl = this.amountControl;
    if (!ctrl.touched && !ctrl.dirty) return null;
    const errors = ctrl.errors;
    if (!errors) return null;
    if (errors['required']) return 'Amount is required';
    if (errors['min']) return 'Amount must be at least ₹1';
    if (errors['maxExceeded']) {
      const max = errors['maxExceeded'].max;
      return `Cannot exceed ₹${max.toLocaleString('en-IN')} (max due)`;
    }
    return null;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const isAll = this.paymentMode() === 'all';
    const amountPaid = Number(raw.amountPaid!);

    this.submitting.set(true);

    if (isAll) {
      // ── Distributed payment: split across all pending fees ────────────────
      // distributePayment() ensures no single fee receives more than its remaining
      const paymentsArray = distributePayment(amountPaid, this.dueFees());

      if (paymentsArray.length === 0) {
        this.toast.error('No pending fees to pay');
        this.submitting.set(false);
        return;
      }

      this.feesService
        .recordFeePayment({
          enrollmentId: this.student().enrollmentId,
          paymentMethod: raw.paymentMethod!,
          notes: raw.notes?.trim() || undefined,
          payments: paymentsArray,
        })
        .subscribe({
          next: (res) => {
            const firstReceipt = res.payment?.receiptNumber ?? '—';
            this.toast.success(`Payment recorded — Receipt: ${firstReceipt}`);
            this.submitting.set(false);
            this.paymentRecorded.emit();
            this.closeDialog();
          },
          error: (err) => {
            const msg = err?.error?.error ?? err?.message ?? 'Failed to record payment';
            this.toast.error(msg);
            this.submitting.set(false);
          },
        });
    } else {
      // ── Single fee payment ────────────────────────────────────────────────
      const fee = this.selectedFee();
      if (!fee) {
        this.submitting.set(false);
        return;
      }

      if (amountPaid > fee.remaining) {
        this.toast.error(
          `Cannot pay more than ₹${fee.remaining.toLocaleString('en-IN')} for ${fee.feeType}`
        );
        this.submitting.set(false);
        return;
      }

      this.feesService
        .recordFeePayment({
          enrollmentId: this.student().enrollmentId,
          feeStructureId: fee.id,
          amountPaid,
          paymentMethod: raw.paymentMethod!,
          notes: raw.notes?.trim() || undefined,
        })
        .subscribe({
          next: (res) => {
            this.toast.success(`Payment recorded — Receipt: ${res.payment?.receiptNumber ?? '—'}`);
            this.submitting.set(false);
            this.paymentRecorded.emit();
            this.closeDialog();
          },
          error: (err) => {
            const msg = err?.error?.error ?? err?.message ?? 'Failed to record payment';
            this.toast.error(msg);
            this.submitting.set(false);
          },
        });
    }
  }

  closeDialog() {
    this.animatingOut.set(true);
    setTimeout(() => {
      this.closed.emit();
    }, 280);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  feeStatusClass(fee: DueFee): string {
    if (fee.remaining <= 0) return 'cleared';
    if (fee.paid > 0) return 'partial';
    if (fee.dueDate && fee.dueDate < new Date().toISOString().split('T')[0]) return 'overdue';
    return 'pending';
  }

  feeStatusLabel(fee: DueFee): string {
    if (fee.remaining <= 0) return 'Cleared';
    if (fee.paid > 0) return 'Partial';
    if (fee.dueDate && fee.dueDate < new Date().toISOString().split('T')[0]) return 'Overdue';
    return 'Pending';
  }

  paidPercent(fee: DueFee): number {
    if (fee.amount === 0) return 100;
    return Math.min(100, Math.round((fee.paid / fee.amount) * 100));
  }

  isSelected(fee: DueFee): boolean {
    return this.paymentMode() === 'single' && this.selectedFee()?.id === fee.id;
  }

  isCleared(fee: DueFee): boolean {
    return fee.remaining <= 0;
  }

  formatINR(amount: number): string {
    return amount.toLocaleString('en-IN');
  }
}
