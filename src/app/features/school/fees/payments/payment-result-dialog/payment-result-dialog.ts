// features/school/fees/payments/payment-result-dialog/payment-result-dialog.ts
import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { AuthService } from '../../../../../core/services/auth.service';
import { FeeReceiptService } from '../../../../../core/services/fee-receipt.service';
import { FeeReceiptDialogComponent } from '../../../../../shared/components/fee-receipt-dialog/fee-receipt-dialog';

export interface PaymentResultData {
  success: boolean;
  errorMessage?: string;
  receiptNumbers?: string[];
  totalPaid?: number;
  paymentMethod?: string;
  paymentCount?: number;
  studentName?: string;
  className?: string;
  sectionName?: string;
  // ── NEW — needed to build a printable/viewable receipt with no round-trip
  rollNumber?: string | null;
  academicYearName?: string;
  payments?: Array<{
    id?: number;
    feeType: string;
    amountPaid: number;
    receiptNumber: string;
    source?: 'STRUCTURE' | 'ASSIGNMENT';
    feeMonth?: string | null;
  }>;
}

@Component({
  selector: 'app-payment-result-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, PaisePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-result-dialog.html',
  styleUrls: ['./payment-result-dialog.scss'],
})
export class PaymentResultDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PaymentResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PaymentResultData,
    private authService: AuthService,
    private receiptService: FeeReceiptService,
    private dialog: MatDialog
  ) { }

  private buildReceiptData() {
    if (!this.data.success || !this.data.payments) return null;
    const branding = this.authService.getStoredSchoolBranding();
    return this.receiptService.buildFromPaymentResult({
      school: {
        name: branding?.name ?? '',
        shortName: branding?.shortName ?? null,
        logoUrl: branding?.logoUrl ?? null,
        addressLineOne: branding?.addressLineOne ?? '',
        addressLineTwo: branding?.addressLineTwo ?? '',
        phone: branding?.phone ?? '',
        email: branding?.email ?? '',
      },
      student: {
        name: this.data.studentName ?? '',
        rollNumber: this.data.rollNumber ?? null,
        className: this.data.className ?? '',
        sectionName: this.data.sectionName ?? '',
        academicYearName: this.data.academicYearName ?? '',
      },
      paymentMethod: (this.data.paymentMethod as any) ?? 'CASH',
      payments: this.data.payments,
      totalPaid: this.data.totalPaid ?? 0,
    });
  }

  viewReceipt(): void {
    const receiptData = this.buildReceiptData();
    if (!receiptData) return;
    this.dialog.open(FeeReceiptDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog',
      data: { receiptData },
    });
  }

  printReceipt(): void {
    const receiptData = this.buildReceiptData();
    if (!receiptData) return;
    // Open the tab synchronously, directly on this click, to avoid popup
    // blockers — see FeeReceiptPdfService.print() doc comment.
    const printWindow = window.open('', '_blank');
    this.dialog.open(FeeReceiptDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      panelClass: 'receipt-dialog',
      data: { receiptData, autoAction: 'print', printWindow },
    });
  }

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
