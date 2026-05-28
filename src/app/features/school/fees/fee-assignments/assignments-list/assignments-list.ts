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
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeesService, StudentFeeAssignment } from '../../../../../core/services/fees.service';

import { FeeStatusBadge } from '../../../../../shared/components/fee-status-badge/fee-status-badge';

import { ConcessionsFormComponent } from '../../fee-concessions/concessions-form/concessions-form';
import { AssignmentFormComponent } from '../assignment-form/assignment-form';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { RecordPaymentComponent } from '../../payments/record-payment/record-payment';
import { BulkAssignmentFormComponent } from '../bulk-assignment-form/bulk-assignment-form';

// ── Month group shape (mirrors student-fees grouping) ─────────────────────────
export interface AssignmentMonthGroup {
  monthKey: string | null;
  label: string;
  items: StudentFeeAssignment[];
}

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

  // ── Month-grouped assignments (used by table template) ────────────────────────
  assignmentGroups = computed<AssignmentMonthGroup[]>(() =>
    this.buildMonthGroups(this.assignments().filter((a) => this.showCancelled() || !a.isCancelled))
  );

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
        // Pre-select this specific assignment — opens in structure-wise mode
        preselectedAssignmentId: a.id,
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        // Result dialog already shown by RecordPaymentComponent — just refresh
        this.load();
        this.changed.emit();
      }
    });
  }

  /**
   * Opens the concession form pre-targeted to a specific custom fee assignment.
   *
   * Key fixes vs the previous implementation:
   *
   * 1. `preselectedAssignmentId: a.id` — tells the form to auto-select this
   *    assignment after `getStudentFeeAssignments` resolves, hiding the
   *    dropdown and immediately checking for an existing concession.
   *
   * 2. `isPaid: a.balance <= 0` — passes the settled-fee flag so the form
   *    hides the "Revoke & Replace" button when the fee is fully paid.
   *    `a.balance` is computed by `getStudentFeeAssignments` in the service
   *    and accounts for concessions (effectiveAmount − amountPaid).
   *
   * Previously this method passed neither field, so:
   *   • The dropdown was never hidden or pre-selected (user had to pick again).
   *   • The existing-concession banner never appeared on open.
   *   • The paid-lock state was ignored (revoke was always shown).
   */
  openConcession(a: StudentFeeAssignment): void {
    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: this.enrollmentId,
        studentName: this.studentName,
        mode: 'ASSIGNMENT',
        // ── Pre-select this specific assignment ───────────────────────────
        // The form's loadData() patches this ID into the form AFTER the
        // assignments list is fetched, triggering valueChanges which:
        //   a) sets selectedBaseAmount from the assignment's amount
        //   b) calls checkExistingConcession() to look up active concessions
        //   c) hides the dropdown (compact mode-pill shown instead)
        preselectedAssignmentId: a.id,
        // ── Lock revoke when fee is fully settled ─────────────────────────
        // balance = effectiveAmount (after concession) − amountPaid.
        // When <= 0 the fee is paid in full; revoking the concession would
        // retroactively create a new outstanding balance — block it at UI level.
        isPaid: a.balance <= 0,
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

  formatMonthFull(feeMonth: string | null): string {
    if (!feeMonth) return 'One-time fees';
    const [y, m] = feeMonth.split('-');
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  trackById(_: number, item: StudentFeeAssignment): number {
    return item.id;
  }

  trackByGroup(_: number, group: AssignmentMonthGroup): string {
    return group.monthKey ?? '__one_time__';
  }

  get activeCount(): number {
    return this.assignments().filter((a) => !a.isCancelled).length;
  }

  get totalBalance(): number {
    return this.assignments()
      .filter((a) => !a.isCancelled)
      .reduce((s, a) => s + (a.balance ?? 0), 0);
  }

  private buildMonthGroups(fees: StudentFeeAssignment[]): AssignmentMonthGroup[] {
    if (!fees.length) return [];

    const groups: AssignmentMonthGroup[] = [];
    let currentKey: string | null | undefined = undefined;
    let currentItems: StudentFeeAssignment[] = [];

    for (const fee of fees) {
      const key = fee.feeMonth;
      if (key !== currentKey) {
        if (currentKey !== undefined) {
          groups.push({
            monthKey: currentKey,
            label: this.formatMonthFull(currentKey),
            items: currentItems,
          });
        }
        currentKey = key;
        currentItems = [fee];
      } else {
        currentItems.push(fee);
      }
    }

    if (currentKey !== undefined && currentItems.length > 0) {
      groups.push({
        monthKey: currentKey,
        label: this.formatMonthFull(currentKey),
        items: currentItems,
      });
    }

    return groups;
  }
}
