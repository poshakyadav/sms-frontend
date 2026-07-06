// features/school/fees/payments/record-payment/record-payment.ts
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
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialog,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  DueFeeItem,
  DueFeesResponse,
  FeesService,
  PaymentMethod,
} from '../../../../../core/services/fees.service';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { FeeRowFilterPipe } from '../../../../../shared/pipes/fee-row-filter-pipe';
import {
  PaymentResultDialogComponent,
  PaymentResultData,
} from '../payment-result-dialog/payment-result-dialog';

// ── Payment mode ──────────────────────────────────────────────────────────────
// 'all'            → pay every outstanding fee item at full remaining balance
// 'partial'        → user edits each amount freely (validated against max)
// 'structure-wise' → only one pre-selected fee structure OR assignment is shown
export type PaymentMode = 'all' | 'partial' | 'structure-wise';

export interface RecordPaymentData {
  enrollmentId: number;
  studentName?: string;
  className?: string;
  sectionName?: string;

  rollNumber?: string | null;
  academicYearName?: string;

  // ── Structure-wise mode ───────────────────────────────────────────────────
  // Exactly ONE of these is set when the dialog is opened from a fee row button.
  // When set, the dialog opens in 'structure-wise' mode and the mode tabs are hidden.
  preselectedFeeStructureId?: number;
  preselectedAssignmentId?: number;
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
    FeeRowFilterPipe,
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

  // ── All rows (filtered per mode) ─────────────────────────────────────────
  allRows = signal<PayableRow[]>([]);

  // ── Payment mode ──────────────────────────────────────────────────────────
  // Locked to 'structure-wise' when opened with a preselected fee.
  mode = signal<PaymentMode>('all');

  // True when this dialog was opened from a specific row — hides mode tabs
  readonly isStructureWise: boolean;

  readonly availableModes: PaymentMode[] = ['all', 'partial'];

  selectedMethod = signal<PaymentMethod>('CASH');
  notes = signal('');

  paymentMethods = PAYMENT_METHODS;

  // ── Rows visible in current mode ──────────────────────────────────────────
  rows = computed<PayableRow[]>(() => {
    const all = this.allRows();
    const m = this.mode();

    if (m === 'structure-wise') {
      // Only the pre-selected row (already filtered during buildRows)
      return all;
    }

    // 'all' and 'partial' show every row with remaining > 0
    return all.filter((r) => r.maxRupees > 0);
  });

  totalToPay = computed(() =>
    this.rows().reduce((sum, r) => {
      if ((r.amountToPayRupees || 0) <= 0) return sum;
      return sum + Math.round((r.amountToPayRupees || 0) * 100);
    }, 0)
  );

  hasErrors = computed(() => this.rows().some((r) => r.error !== null));

  constructor(
    private fees: FeesService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<RecordPaymentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecordPaymentData
  ) {
    this.isStructureWise =
      data.preselectedFeeStructureId !== undefined || data.preselectedAssignmentId !== undefined;

    if (this.isStructureWise) {
      this.mode.set('structure-wise');
    }
  }

  ngOnInit(): void {
    this.loadDueFees();
  }

  // ── Mode label helpers ────────────────────────────────────────────────────

  modeLabel(m: PaymentMode): string {
    return { all: 'All Fees', partial: 'Partial', 'structure-wise': 'Selected Fee' }[m];
  }

  modeIcon(m: PaymentMode): string {
    return { all: 'done_all', partial: 'tune', 'structure-wise': 'filter_alt' }[m];
  }

  setMode(m: PaymentMode): void {
    this.mode.set(m);
    // Rebuild amounts for the new mode
    const df = this.dueFees();
    if (df) this.buildRows(df);
  }

  // ── Data loading ──────────────────────────────────────────────────────────

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
    const m = this.mode();

    let structureFees = res.fees.filter((f) => f.remaining > 0);
    let assignmentFees = res.assignments.filter((a) => a.remaining > 0);

    // ── structure-wise: keep only the pre-selected item ──────────────────
    if (m === 'structure-wise') {
      if (this.data.preselectedFeeStructureId !== undefined) {
        structureFees = structureFees.filter((f) => f.id === this.data.preselectedFeeStructureId);
        assignmentFees = [];
      } else if (this.data.preselectedAssignmentId !== undefined) {
        assignmentFees = assignmentFees.filter((a) => a.id === this.data.preselectedAssignmentId);
        structureFees = [];
      }
    }

    const makeRow = (f: DueFeeItem, source: 'STRUCTURE' | 'ASSIGNMENT'): PayableRow => {
      const maxRupees = f.remaining / 100;
      return {
        item: f,
        source,
        // 'all' + 'structure-wise': pre-fill at full remaining balance
        // 'partial': pre-fill at 0 so user enters their own amount
        amountToPayRupees: m === 'partial' ? 0 : maxRupees,
        maxRupees,
        error: null,
      };
    };

    this.allRows.set([
      ...structureFees.map((f) => makeRow(f, 'STRUCTURE')),
      ...assignmentFees.map((a) => makeRow(a, 'ASSIGNMENT')),
    ]);
  }

  // ── Input handlers ────────────────────────────────────────────────────────

  onAmountChange(row: PayableRow, val: number): void {
    row.amountToPayRupees = val;
    if (val > row.maxRupees + 0.001) {
      row.error = `Max ₹${row.maxRupees.toFixed(2)}`;
    } else if (val < 0) {
      row.error = 'Cannot be negative';
    } else {
      row.error = null;
    }
    this.allRows.update((list) => [...list]);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  submit(): void {
    if (this.hasErrors()) return;

    const payableRows = this.rows().filter((r) => (r.amountToPayRupees || 0) > 0);
    if (payableRows.length === 0) {
      this.error.set('Enter at least one payment amount');
      return;
    }

    const payments = payableRows.map((r) => {
      const obj: Record<string, number> = {
        amountPaid: Math.round(r.amountToPayRupees * 100),
      };
      if (r.source === 'STRUCTURE') obj['feeStructureId'] = r.item.id;
      else obj['studentFeeAssignmentId'] = r.item.id;
      return obj;
    });

    this.saving.set(true);
    this.error.set(null);

    this.fees
      .recordFeePayment({
        enrollmentId: this.data.enrollmentId,
        paymentMethod: this.selectedMethod(),
        notes: this.notes() || undefined,
        payments: payments as any,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);

          // Build breakdown for result dialog
          const breakdown = (res.payments ?? []).map((p: any) => ({
            id: p.id,
            feeType: p.feeType ?? 'Fee',
            feeMonth: p.feeMonth ?? null,
            amountPaid: p.amountPaid,
            receiptNumber: p.receiptNumber,
            source: p.feeStructureId ? ('STRUCTURE' as const) : ('ASSIGNMENT' as const),
          }));

          const resultData: PaymentResultData = {
            success: true,
            receiptNumbers: res.meta?.receiptNumbers ?? [],
            totalPaid: res.meta?.totalPaid ?? 0,
            paymentMethod: this.selectedMethod(),
            paymentCount: res.meta?.paymentCount ?? 1,
            studentName: this.data.studentName,
            className: this.data.className,
            sectionName: this.data.sectionName,
            rollNumber: this.data.rollNumber,
            academicYearName: this.data.academicYearName,
            payments: breakdown,
          };

          // Close payment dialog first, then open result
          this.dialogRef.close(res);

          setTimeout(() => {
            this.dialog.open(PaymentResultDialogComponent, {
              width: '480px',
              maxWidth: '95vw',
              panelClass: 'payment-result-dialog',
              data: resultData,
              disableClose: false,
            });
          }, 120);
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.error ?? 'Failed to record payment';
          this.error.set(msg);

          // Open failure result dialog
          this.dialogRef.close(null);

          setTimeout(() => {
            this.dialog.open(PaymentResultDialogComponent, {
              width: '480px',
              maxWidth: '95vw',
              panelClass: 'payment-result-dialog',
              data: {
                success: false,
                errorMessage: msg,
                studentName: this.data.studentName,
              } as PaymentResultData,
              disableClose: false,
            });
          }, 120);
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  statusOf(item: DueFeeItem): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' {
    if (item.remaining <= 0) return 'PAID';
    if (item.paid > 0) return 'PARTIAL';
    if (item.dueDate && item.dueDate < new Date().toISOString().split('T')[0]) return 'OVERDUE';
    return 'PENDING';
  }

  // Summary line shown below mode tabs
  get modeSummary(): string {
    const m = this.mode();
    const rows = this.rows();
    if (m === 'all')
      return `${rows.length} outstanding fee${rows.length !== 1 ? 's' : ''} — paying full balance`;
    if (m === 'partial')
      return `${rows.length} outstanding fee${rows.length !== 1 ? 's' : ''
        } — enter partial amounts`;
    if (m === 'structure-wise') {
      if (rows.length === 0) return 'Selected fee is already paid';
      return `Paying 1 fee — ${rows[0].source === 'STRUCTURE' ? 'Standard' : 'Custom'}: ${rows[0].item.feeType
        }`;
    }
    return '';
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
