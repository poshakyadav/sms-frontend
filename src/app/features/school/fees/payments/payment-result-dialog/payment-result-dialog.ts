// features/school/fees/payments/payment-result-dialog/payment-result-dialog.ts
import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';

export interface PaymentResultData {
  success: boolean;
  errorMessage?: string;
  // Present on success
  receiptNumbers?: string[];
  totalPaid?: number;
  paymentMethod?: string;
  paymentCount?: number;
  studentName?: string;
  className?: string;
  sectionName?: string;
  payments?: Array<{
    feeType: string;
    amountPaid: number;
    receiptNumber: string;
  }>;
}

@Component({
  selector: 'app-payment-result-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, PaisePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="prd-shell">
      <!-- Header -->
      <div
        class="prd-header"
        [class.prd-header--success]="data.success"
        [class.prd-header--error]="!data.success"
      >
        <div class="prd-header__icon">
          <mat-icon>{{ data.success ? 'check_circle' : 'error_outline' }}</mat-icon>
        </div>
        <div class="prd-header__text">
          <h2 class="prd-title">{{ data.success ? 'Payment Recorded' : 'Payment Failed' }}</h2>
          <p class="prd-subtitle">
            @if (data.success) {
            {{ data.studentName }}
            @if (data.className) { — {{ data.className
            }}{{ data.sectionName ? '-' + data.sectionName : '' }} } } @else { Something went wrong.
            Please try again. }
          </p>
        </div>
        <button mat-icon-button class="prd-close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="prd-body">
        <!-- ── SUCCESS state ─────────────────────────────────────────── -->
        @if (data.success) {

        <!-- Grand total strip -->
        <div class="prd-total-strip">
          <div class="prd-total-strip__icon"><mat-icon>payments</mat-icon></div>
          <div class="prd-total-strip__text">
            <span class="prd-total-strip__label">Total Amount Paid</span>
            <span class="prd-total-strip__amount">{{ data.totalPaid! | paise }}</span>
          </div>
          @if (data.paymentMethod) {
          <div class="prd-method-badge">
            <mat-icon>{{ methodIcon(data.paymentMethod) }}</mat-icon>
            {{ methodLabel(data.paymentMethod) }}
          </div>
          }
        </div>

        <!-- Per-payment breakdown -->
        @if (data.payments && data.payments.length > 0) {
        <div class="prd-breakdown">
          <div class="prd-breakdown__header">
            <mat-icon>receipt_long</mat-icon>
            <span>Payment breakdown</span>
          </div>
          @for (p of data.payments; track p.receiptNumber) {
          <div class="prd-breakdown__row">
            <span class="prd-breakdown__fee-chip">{{ p.feeType }}</span>
            <span class="prd-breakdown__amount">{{ p.amountPaid | paise : 'compact' }}</span>
            <span class="prd-breakdown__receipt">{{ p.receiptNumber }}</span>
          </div>
          }
        </div>
        }

        <!-- Receipt numbers -->
        @if (data.receiptNumbers && data.receiptNumbers.length > 0) {
        <div class="prd-receipts">
          <div class="prd-receipts__label">
            <mat-icon>confirmation_number</mat-icon>
            {{ data.receiptNumbers.length === 1 ? 'Receipt Number' : 'Receipt Numbers' }}
          </div>
          <div class="prd-receipts__list">
            @for (r of data.receiptNumbers; track r) {
            <span class="prd-receipt-chip">{{ r }}</span>
            }
          </div>
        </div>
        }

        <!-- Success notice -->
        <div class="prd-notice prd-notice--success">
          <mat-icon>email</mat-icon>
          <p>A receipt has been sent to the student's registered email address.</p>
        </div>

        }

        <!-- ── ERROR state ────────────────────────────────────────────── -->
        @if (!data.success) {
        <div class="prd-error-body">
          <div class="prd-error-icon"><mat-icon>warning_amber</mat-icon></div>
          <p class="prd-error-message">
            {{ data.errorMessage || 'An unexpected error occurred while recording the payment.' }}
          </p>
          <div class="prd-notice prd-notice--warning">
            <mat-icon>info_outline</mat-icon>
            <p>
              No payment has been charged. Please check the details and try again, or contact
              support if the issue persists.
            </p>
          </div>
        </div>
        }
      </div>

      <!-- Footer -->
      <div class="prd-footer">
        @if (data.success) {
        <button mat-flat-button color="primary" (click)="close()">
          <mat-icon>done</mat-icon>
          Done
        </button>
        } @else {
        <button mat-stroked-button (click)="close()">Close</button>
        <button mat-flat-button color="primary" (click)="retry()">
          <mat-icon>refresh</mat-icon>
          Try Again
        </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .prd-shell {
        display: flex;
        flex-direction: column;
        max-width: 480px;
        width: 100%;
        background: var(--color-bg-card);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .prd-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 20px 24px 16px;
        border-bottom: 1px solid var(--color-divider);

        &--success {
          background: color-mix(in srgb, var(--color-success) 5%, var(--color-bg-card));
        }
        &--error {
          background: color-mix(in srgb, var(--color-error) 5%, var(--color-bg-card));
        }

        &__icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 24px;
            height: 24px;
            width: 24px;
          }
        }
        &__text {
          flex: 1;
        }
      }

      .prd-header--success .prd-header__icon {
        background: color-mix(in srgb, var(--color-success) 15%, transparent);
        mat-icon {
          color: var(--color-success);
        }
      }
      .prd-header--error .prd-header__icon {
        background: color-mix(in srgb, var(--color-error) 15%, transparent);
        mat-icon {
          color: var(--color-error);
        }
      }

      .prd-title {
        margin: 0 0 3px;
        font-size: 1rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .prd-subtitle {
        margin: 0;
        font-size: 0.8rem;
        color: var(--color-text-secondary);
      }
      .prd-close {
        color: var(--color-text-muted);
      }

      .prd-body {
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* Total strip */
      .prd-total-strip {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: color-mix(in srgb, var(--color-success) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-success) 20%, transparent);
        border-radius: var(--radius-md);

        &__icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: color-mix(in srgb, var(--color-success) 15%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon {
            font-size: 20px;
            height: 20px;
            width: 20px;
            color: var(--color-success);
          }
        }
        &__text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        &__label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
        }
        &__amount {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--color-success);
          font-variant-numeric: tabular-nums;
        }
      }

      .prd-method-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-main);
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        flex-shrink: 0;
        mat-icon {
          font-size: 14px;
          height: 14px;
          width: 14px;
        }
      }

      /* Breakdown */
      .prd-breakdown {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        overflow: hidden;

        &__header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--color-hover);
          border-bottom: 1px solid var(--color-divider);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          mat-icon {
            font-size: 14px;
            height: 14px;
            width: 14px;
            color: var(--color-primary);
          }
        }

        &__row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-top: 1px solid var(--color-divider);
          font-size: 0.83rem;
          &:first-of-type {
            border-top: none;
          }
        }

        &__fee-chip {
          font-weight: 600;
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        &__amount {
          font-weight: 700;
          color: var(--color-success);
          font-variant-numeric: tabular-nums;
        }
        &__receipt {
          font-size: 0.7rem;
          font-family: 'Courier New', monospace;
          background: var(--color-hover);
          color: var(--color-text-muted);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--color-border);
          white-space: nowrap;
        }
      }

      /* Receipts */
      .prd-receipts {
        &__label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          margin-bottom: 8px;
          mat-icon {
            font-size: 14px;
            height: 14px;
            width: 14px;
            color: var(--color-primary);
          }
        }
        &__list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
      }

      .prd-receipt-chip {
        display: inline-block;
        font-family: 'Courier New', monospace;
        font-size: 0.78rem;
        font-weight: 700;
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: var(--color-primary);
        border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
        padding: 3px 10px;
        border-radius: 4px;
      }

      /* Notice banners */
      .prd-notice {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        font-size: 0.8rem;
        line-height: 1.5;

        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        p {
          margin: 0;
        }

        &--success {
          background: color-mix(in srgb, var(--color-success) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-success) 18%, transparent);
          color: color-mix(in srgb, var(--color-success) 60%, var(--color-text-primary));
          mat-icon {
            color: var(--color-success);
          }
        }
        &--warning {
          background: color-mix(in srgb, var(--color-warning) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-warning) 18%, transparent);
          color: color-mix(in srgb, var(--color-warning) 60%, var(--color-text-primary));
          mat-icon {
            color: var(--color-warning);
          }
        }
      }

      /* Error state */
      .prd-error-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        text-align: center;
      }
      .prd-error-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--color-error) 12%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon {
          font-size: 28px;
          height: 28px;
          width: 28px;
          color: var(--color-error);
        }
      }
      .prd-error-message {
        margin: 0;
        font-size: 0.88rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
        max-width: 340px;
      }

      /* Footer */
      .prd-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 24px 20px;
        border-top: 1px solid var(--color-divider);

        button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          mat-icon {
            font-size: 17px;
            height: 17px;
            width: 17px;
          }
        }
      }
    `,
  ],
})
export class PaymentResultDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PaymentResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PaymentResultData
  ) {}

  close(): void {
    this.dialogRef.close('dismiss');
  }

  retry(): void {
    this.dialogRef.close('retry');
  }

  methodIcon(method: string): string {
    const map: Record<string, string> = {
      CASH: 'payments',
      CHECK: 'receipt',
      BANK_TRANSFER: 'account_balance',
    };
    return map[method] ?? 'payments';
  }

  methodLabel(method: string): string {
    const map: Record<string, string> = {
      CASH: 'Cash',
      CHECK: 'Cheque',
      BANK_TRANSFER: 'Bank Transfer',
    };
    return map[method] ?? method;
  }
}
