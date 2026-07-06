// features/school/fees/fee-item-payment-history/fee-item-payment-history-dialog.ts
import { Component, Inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeeReceiptService, FeeItemPaymentRow } from '../../../../core/services/fee-receipt.service';
import { FeeSource, PaymentMethod } from '../../../../core/services/fees.service';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';
import { FeeReceiptDialogComponent } from '../../../../shared/components/fee-receipt-dialog/fee-receipt-dialog';

export interface FeeItemPaymentHistoryData {
  enrollmentId: number;
  source: FeeSource;
  feeId: number;
  feeType: string;
  feeMonth?: string | null;
  studentName?: string;
}

@Component({
  selector: 'app-fee-item-payment-history-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, PaisePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-item-payment-history-dialog.html',
  styleUrl: './fee-item-payment-history-dialog.scss',
})
export class FeeItemPaymentHistoryDialogComponent implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  payments = signal<FeeItemPaymentRow[]>([]);

  constructor(
    private receiptService: FeeReceiptService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<FeeItemPaymentHistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeItemPaymentHistoryData
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.receiptService
      .getPaymentsForFeeItem(this.data.enrollmentId, this.data.source, this.data.feeId)
      .subscribe({
        next: (list) => {
          this.payments.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load payment history');
          this.loading.set(false);
        },
      });
  }

  openReceipt(payment: FeeItemPaymentRow): void {
    this.dialog.open(FeeReceiptDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog',
      data: { paymentId: payment.id },
    });
  }

  methodIcon(method: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = { CASH: 'payments', CHECK: 'receipt', BANK_TRANSFER: 'account_balance' };
    return map[method] ?? 'payments';
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get totalCollected(): number {
    return this.payments().filter((p) => !p.isVoid).reduce((s, p) => s + p.amountPaid, 0);
  }

  trackById(_: number, p: FeeItemPaymentRow): number {
    return p.id;
  }

  close(): void {
    this.dialogRef.close();
  }
}