// shared/components/fee-receipt-dialog/fee-receipt-dialog.ts
import {
  Component, Inject, OnInit, AfterViewInit, ViewChild, ElementRef, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeeReceiptData, FeeReceiptService } from '../../../core/services/fee-receipt.service';
import { FeeReceiptPdfService } from '../../../core/services/fee-receipt-pdf.service';
import { FeeReceiptViewComponent } from '../fee-receipt-view/fee-receipt-view';

export interface FeeReceiptDialogData {
  /** Provide either paymentId (fetched from backend) OR receiptData (instant, in-memory). */
  paymentId?: number;
  receiptData?: FeeReceiptData;
  /** Fires the print pipeline automatically once the receipt is ready. */
  autoAction?: 'print' | null;
  /**
   * A window opened SYNCHRONOUSLY by the caller on the original click, before
   * any async work — required for the auto-print flow to avoid popup
   * blockers (see FeeReceiptPdfService.print doc comment).
   */
  printWindow?: Window | null;
}

@Component({
  selector: 'app-fee-receipt-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, FeeReceiptViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-receipt-dialog.html',
  styleUrl: './fee-receipt-dialog.scss',
})
export class FeeReceiptDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('receiptNode') receiptNode?: ElementRef<HTMLElement>;

  loading = signal(false);
  error = signal<string | null>(null);
  receipt = signal<FeeReceiptData | null>(null);
  working = signal<'print' | 'download' | null>(null);

  private autoActionFired = false;

  constructor(
    private receiptService: FeeReceiptService,
    private pdfService: FeeReceiptPdfService,
    private snack: MatSnackBar,
    public dialogRef: MatDialogRef<FeeReceiptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeReceiptDialogData
  ) { }

  ngOnInit(): void {
    if (this.data.receiptData) {
      this.receipt.set(this.data.receiptData);
      return;
    }
    if (this.data.paymentId) {
      this.load(this.data.paymentId);
    } else {
      this.error.set('No receipt reference provided');
    }
  }

  ngAfterViewInit(): void {
    if (this.data.receiptData && this.data.autoAction === 'print') {
      setTimeout(() => this.maybeFireAutoAction(), 50);
    }
  }

  load(paymentId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.receiptService.getReceiptByPaymentId(paymentId).subscribe({
      next: (res) => {
        this.receipt.set(res);
        this.loading.set(false);
        setTimeout(() => this.maybeFireAutoAction(), 50);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load receipt');
        this.loading.set(false);
      },
    });
  }

  private maybeFireAutoAction(): void {
    if (this.autoActionFired) return;
    if (this.data.autoAction === 'print' && this.receipt() && this.receiptNode) {
      this.autoActionFired = true;
      this.onPrint();
    }
  }

  onPrint(): void {
    if (!this.receiptNode || this.working()) return;
    this.working.set('print');
    this.pdfService
      .print(this.receiptNode.nativeElement, this.fileName(), 'a5', this.data.printWindow)
      .catch(() => this.snack.open('Could not open print preview', 'Close', { duration: 3000 }))
      .finally(() => this.working.set(null));
  }

  onDownload(): void {
    if (!this.receiptNode || this.working()) return;
    this.working.set('download');
    this.pdfService
      .download(this.receiptNode.nativeElement, this.fileName())
      .catch(() => this.snack.open('Could not generate PDF', 'Close', { duration: 3000 }))
      .finally(() => this.working.set(null));
  }

  private fileName(): string {
    return `receipt-${this.receipt()?.primaryReceiptNumber ?? 'unknown'}`;
  }

  close(): void {
    this.dialogRef.close();
  }
}