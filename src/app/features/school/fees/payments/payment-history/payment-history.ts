// features/school/fees/fee-payments/payment-history/payment-history.ts
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import {
  FeesService,
  PaymentHistoryRow,
  PaymentMethod,
} from '../../../../../core/services/fees.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    PaisePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-history.html',
  styleUrls: ['./payment-history.scss'],
})
export class PaymentHistory implements OnChanges {
  @Input({ required: true }) enrollmentId!: number;
  @Input() canVoid = false;

  loading = signal(false);
  error = signal<string | null>(null);
  history = signal<PaymentHistoryRow[]>([]);

  voidingPayment = signal<PaymentHistoryRow | null>(null);
  voidReason = '';
  voidSaving = signal(false);

  constructor(private fees: FeesService, private snack: MatSnackBar) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['enrollmentId'] && this.enrollmentId) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getPaymentHistory(this.enrollmentId).subscribe({
      next: (rows) => {
        this.history.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load payment history');
        this.loading.set(false);
      },
    });
  }

  openVoidDialog(payment: PaymentHistoryRow): void {
    this.voidingPayment.set(payment);
    this.voidReason = '';
  }

  cancelVoid(): void {
    this.voidingPayment.set(null);
    this.voidReason = '';
  }

  confirmVoid(): void {
    const p = this.voidingPayment();
    if (!p || this.voidReason.trim().length < 5) return;

    this.voidSaving.set(true);
    this.fees.voidFeePayment(p.id, this.voidReason.trim()).subscribe({
      next: () => {
        this.voidSaving.set(false);
        this.voidingPayment.set(null);
        this.snack.open('Payment voided successfully', 'Close', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        this.voidSaving.set(false);
        this.snack.open(err?.error?.error ?? 'Failed to void payment', 'Close', {
          duration: 4000,
          panelClass: 'error-toast',
        });
      },
    });
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

  methodLabel(method: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      CASH: 'Cash',
      CHECK: 'Cheque',
      BANK_TRANSFER: 'Bank',
    };
    return map[method] ?? method;
  }

  methodIcon(method: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      CASH: 'payments',
      CHECK: 'receipt',
      BANK_TRANSFER: 'account_balance',
    };
    return map[method] ?? 'payment';
  }
}
