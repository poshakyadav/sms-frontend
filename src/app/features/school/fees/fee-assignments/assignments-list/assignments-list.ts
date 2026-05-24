// features/school/fees/fee-assignments/assignments-list/assignments-list.ts
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeesService, StudentFeeAssignment } from '../../../../../core/services/fees.service';

import { FeeStatusBadge } from '../../../../../shared/components/fee-status-badge/fee-status-badge';

import { ConcessionsFormComponent } from '../../fee-concessions/concessions-form/concessions-form';
import { AssignmentFormComponent } from '../assignment-form/assignment-form';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { RecordPaymentComponent } from '../../payments/record-payment/record-payment';
import { BulkAssignmentFormComponent } from '../bulk-assignment-form/bulk-assignment-form';

@Component({
  selector: 'app-assignments-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatSnackBarModule,
    PaisePipe,
    FeeStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignments-list.html',
  styleUrl: './assignments-list.scss',
})
export class AssignmentsList implements OnChanges {
  @Input({ required: true }) enrollmentId!: number;
  @Input() studentName?: string;
  @Input() academicYearId?: number;
  @Input() canManage = false;
  @Input() canPay = false;

  /** Emits when a payment or concession is saved — parent should refresh balances */
  @Output() changed = new EventEmitter<void>();

  loading = signal(false);
  error = signal<string | null>(null);
  assignments = signal<StudentFeeAssignment[]>([]);
  showCancelled = signal(false);

  /** Inline cancel confirmation state */
  cancellingId = signal<number | null>(null);
  cancelReason = signal('');

  constructor(private fees: FeesService, private dialog: MatDialog, private snack: MatSnackBar) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['enrollmentId'] && this.enrollmentId) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getStudentFeeAssignments(this.enrollmentId, this.showCancelled()).subscribe({
      next: (list) => {
        this.assignments.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load fee assignments');
        this.loading.set(false);
      },
    });
  }

  onShowCancelledToggle(val: boolean): void {
    this.showCancelled.set(val);
    this.load();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  openAddAssignment(): void {
    const ref = this.dialog.open(AssignmentFormComponent, {
      width: '540px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: this.enrollmentId,
        studentName: this.studentName,
        academicYearId: this.academicYearId,
      },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.snack.open('Fee assignment created', 'Close', { duration: 3000 });
        this.load();
        this.changed.emit();
      }
    });
  }

  openBulkAssignment(): void {
    const ref = this.dialog.open(BulkAssignmentFormComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: this.enrollmentId,
        studentName: this.studentName,
        academicYearId: this.academicYearId,
      },
    });
    ref.afterClosed().subscribe((monthCount) => {
      if (monthCount) {
        this.snack.open(`${monthCount} monthly assignments created`, 'Close', { duration: 3500 });
        this.load();
        this.changed.emit();
      }
    });
  }

  openPay(a: StudentFeeAssignment): void {
    const ref = this.dialog.open(RecordPaymentComponent, {
      width: '780px',
      maxWidth: '96vw',
      panelClass: 'payment-dialog',
      data: {
        enrollmentId: this.enrollmentId,
        studentName: this.studentName,
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.snack.open(
          `Payment recorded — ${result.meta?.receiptNumbers?.join(', ') ?? ''}`,
          'Close',
          { duration: 4000, panelClass: 'success-toast' }
        );
        this.load();
        this.changed.emit();
      }
    });
  }

  openConcession(a: StudentFeeAssignment): void {
    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: this.enrollmentId,
        studentName: this.studentName,
        mode: 'ASSIGNMENT',
      },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.snack.open('Concession granted', 'Close', { duration: 3000 });
        this.load();
        this.changed.emit();
      }
    });
  }

  startCancel(a: StudentFeeAssignment): void {
    this.cancellingId.set(a.id);
    this.cancelReason.set('');
  }

  cancelCancel(): void {
    this.cancellingId.set(null);
    this.cancelReason.set('');
  }

  confirmCancel(a: StudentFeeAssignment): void {
    if (this.cancelReason().trim().length < 5) return;
    this.fees.cancelStudentFeeAssignment(a.id, this.cancelReason().trim()).subscribe({
      next: () => {
        this.snack.open('Assignment cancelled', 'Close', { duration: 3000 });
        this.cancellingId.set(null);
        this.load();
        this.changed.emit();
      },
      error: (err) => {
        this.snack.open(err?.error?.error ?? 'Failed to cancel assignment', 'Close', {
          duration: 4000,
          panelClass: 'error-toast',
        });
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

  trackById(_: number, item: StudentFeeAssignment): number {
    return item.id;
  }

  get activeCount(): number {
    return this.assignments().filter((a) => !a.isCancelled).length;
  }

  get totalBalance(): number {
    return this.assignments()
      .filter((a) => !a.isCancelled)
      .reduce((s, a) => s + (a.balance ?? 0), 0);
  }
}
