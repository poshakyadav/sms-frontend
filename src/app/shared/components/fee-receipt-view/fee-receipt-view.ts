// shared/components/fee-receipt-view/fee-receipt-view.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FeeReceiptData } from '../../../core/services/fee-receipt.service';
import { PaisePipe } from '../../pipes/paise-pipe';

@Component({
  selector: 'app-fee-receipt-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, PaisePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-receipt-view.html',
  styleUrl: './fee-receipt-view.scss',
})
export class FeeReceiptViewComponent {
  @Input({ required: true }) data!: FeeReceiptData;

  get hasConcession(): boolean {
    return this.data.items.some((i) => i.concessionAmount > 0);
  }

  get hasMultipleReceiptNumbers(): boolean {
    return new Set(this.data.items.map((i) => i.receiptNumber)).size > 1;
  }

  get isFullyVoid(): boolean {
    return this.data.items.length > 0 && this.data.items.every((i) => i.isVoid);
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return 'One-time';
    const [y, m] = feeMonth.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  methodLabel(method: string): string {
    const map: Record<string, string> = { CASH: 'Cash', CHECK: 'Cheque', BANK_TRANSFER: 'Bank Transfer' };
    return map[method] ?? method;
  }

  trackByItem(_: number, item: FeeReceiptData['items'][number]): number {
    return item.id;
  }

  /** Small, dependency-free ₹ amount-in-words for the receipt footer. */
  amountInWords(paise: number): string {
    const rupees = Math.round(paise / 100);
    if (rupees === 0) return 'Zero Rupees Only';
    return `${this.numberToWords(rupees)} Rupees Only`;
  }

  private numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const twoDigits = (n: number): string =>
      n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;

    const threeDigits = (n: number): string =>
      n < 100 ? twoDigits(n) : `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + twoDigits(n % 100) : ''}`;

    if (num === 0) return 'Zero';

    const crore = Math.floor(num / 1_00_00_000);
    const lakh = Math.floor((num % 1_00_00_000) / 1_00_000);
    const thousand = Math.floor((num % 1_00_000) / 1000);
    const rest = num % 1000;

    const parts: string[] = [];
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (rest) parts.push(threeDigits(rest));
    return parts.join(' ');
  }
}