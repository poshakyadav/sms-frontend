// features/school/fees/fee-payments/record-payment/record-payment.ts
import {
  Component,
  OnInit,
  Inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DueFeeItem, DueFeesResponse, FeesService, PaymentMethod } from '../../../../../core/services/fees.service';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { FeeStatusBadge } from '../../../../../shared/components/fee-status-badge/fee-status-badge';
import { FeeRowFilterPipe } from '../../../../../shared/pipes/fee-row-filter-pipe';


export interface RecordPaymentData {
  enrollmentId: number;
  studentName?: string;
  className?: string;
  sectionName?: string;
}

interface PayableRow {
  item: DueFeeItem;
  source: 'STRUCTURE' | 'ASSIGNMENT';
  amountToPayRupees: number;
  maxRupees: number;
  error: string | null;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Cash', icon: 'payments' },
  { value: 'CHECK', label: 'Cheque', icon: 'receipt' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: 'account_balance' },
];

@Component({
  selector: 'app-record-payment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatFormFieldModule,
    PaisePipe,
    // FeeStatusBadge,
    FeeRowFilterPipe
    
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './record-payment.html',
  styleUrl: './record-payment.scss',
})
export class RecordPaymentComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  dueFees = signal<DueFeesResponse | null>(null);

  rows = signal<PayableRow[]>([]);
  selectedMethod = signal<PaymentMethod>('CASH');
  notes = signal('');

  paymentMethods = PAYMENT_METHODS;

  totalToPay = computed(() => {
    return this.rows().reduce((sum, r) => {
      const paise = Math.round((r.amountToPayRupees || 0) * 100);
      return sum + paise;
    }, 0);
  });

  hasErrors = computed(() => this.rows().some((r) => r.error !== null));

  constructor(
    private fees: FeesService,
    public dialogRef: MatDialogRef<RecordPaymentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecordPaymentData
  ) {}

  ngOnInit(): void {
    this.loadDueFees();
  }

  loadDueFees(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getDueFeesForEnrollment(this.data.enrollmentId).subscribe({
      next: (res) => {
        this.dueFees.set(res);
        this.buildRows(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load due fees');
        this.loading.set(false);
      },
    });
  }

  buildRows(res: DueFeesResponse): void {
    const structureRows: PayableRow[] = res.fees
      .filter((f) => f.remaining > 0)
      .map((f) => ({
        item: f,
        source: 'STRUCTURE' as const,
        amountToPayRupees: f.remaining / 100,
        maxRupees: f.remaining / 100,
        error: null,
      }));

    const assignmentRows: PayableRow[] = res.assignments
      .filter((a) => a.remaining > 0)
      .map((a) => ({
        item: a,
        source: 'ASSIGNMENT' as const,
        amountToPayRupees: a.remaining / 100,
        maxRupees: a.remaining / 100,
        error: null,
      }));

    this.rows.set([...structureRows, ...assignmentRows]);
  }

  onAmountChange(row: PayableRow, val: number): void {
    row.amountToPayRupees = val;
    if (val > row.maxRupees) {
      row.error = `Max is ₹${row.maxRupees.toFixed(2)}`;
    } else if (val < 0) {
      row.error = 'Cannot be negative';
    } else {
      row.error = null;
    }
    // trigger change detection
    this.rows.update((list) => [...list]);
  }

  submit(): void {
    if (this.hasErrors()) return;
    const payableRows = this.rows().filter((r) => (r.amountToPayRupees || 0) > 0);
    if (payableRows.length === 0) {
      this.error.set('Enter at least one payment amount');
      return;
    }

    const payments = payableRows.map((r) => {
      const obj: any = { amountPaid: Math.round(r.amountToPayRupees * 100) };
      if (r.source === 'STRUCTURE') obj.feeStructureId = r.item.id;
      else obj.studentFeeAssignmentId = r.item.id;
      return obj;
    });

    this.saving.set(true);
    this.error.set(null);

    this.fees.recordFeePayment({
      enrollmentId: this.data.enrollmentId,
      paymentMethod: this.selectedMethod(),
      notes: this.notes() || undefined,
      payments,
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to record payment');
        this.saving.set(false);
      },
    });
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  statusOf(item: DueFeeItem): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' {
    if (item.remaining <= 0) return 'PAID';
    if (item.paid > 0) return 'PARTIAL';
    if (item.dueDate && item.dueDate < new Date().toISOString().split('T')[0]) return 'OVERDUE';
    return 'PENDING';
  }

  close(): void {
    this.dialogRef.close(null);
  }
}