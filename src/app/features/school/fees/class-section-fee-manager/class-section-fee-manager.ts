// features/school/fees/class-section-fee-manager/class-section-fee-manager.ts

import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';

import {
  FeesService,
  StudentForPayment,
  DueFeesResponse,
  DueFeeItem,
} from '../../../../core/services/fees.service';
import {
  AcademicsService,
  ClassSection,
  AcademicYear,
} from '../../../../core/services/academics.service';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';
import { RecordPaymentComponent } from '../payments/record-payment/record-payment';
import { ConcessionsFormComponent } from '../fee-concessions/concessions-form/concessions-form';
import { AssignmentsList } from '../fee-assignments/assignments-list/assignments-list';
import { PaymentHistory } from '../payments/payment-history/payment-history';
import { ConcessionsList } from '../fee-concessions/concessions-list/concessions-list';
import { AuthService } from '../../../../core/services/auth.service';
import { FeeStatusBadge } from '../../../../shared/components/fee-status-badge/fee-status-badge';

// ── Month group shape for standard fees ───────────────────────────────────────
export interface StandardFeeMonthGroup {
  monthKey: string | null;
  label: string;
  items: DueFeeItem[];
}

@Component({
  selector: 'app-class-section-fee-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTabsModule,
    PaisePipe,
    AssignmentsList,
    PaymentHistory,
    ConcessionsList,
    FeeStatusBadge
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './class-section-fee-manager.html',
  styleUrl: './class-section-fee-manager.scss',
})
export class ClassSectionFeeManager implements OnInit {
  // ── Filter state ─────────────────────────────────────────────────────────
  academicYears = signal<AcademicYear[]>([]);
  classSections = signal<ClassSection[]>([]);
  selectedAcademicYearId = signal<number | null>(null);
  selectedClassSectionId = signal<number | null>(null);

  // ── Roster state ─────────────────────────────────────────────────────────
  loadingRoster = signal(false);
  errorRoster = signal<string | null>(null);
  students = signal<StudentForPayment[]>([]);
  rosterSearch = signal('');

  filteredStudents = computed(() => {
    const q = this.rosterSearch().trim().toLowerCase();
    if (!q) return this.students();
    return this.students().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber ?? '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  });

  // ── Selected student ──────────────────────────────────────────────────────
  selectedStudent = signal<StudentForPayment | null>(null);

  // ── Due fees for selected student ─────────────────────────────────────────
  loadingDueFees = signal(false);
  dueFees = signal<DueFeesResponse | null>(null);
  errorDueFees = signal<string | null>(null);

  // ── Per-student combined balance cache ────────────────────────────────────
  // Key: enrollmentId → combined balanceDue (standard + custom − concessions − paid)
  // Populated on first click of each student, updated after any payment/concession.
  // This is the ONLY reliable source of the true combined balance because
  // StudentForPayment.balance from getStudentsByClassSection only reflects
  // standard fee structures and misses custom fee assignments entirely.
  private studentBalanceCache = signal<Map<number, number>>(new Map());

  // ── Permissions ───────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('fees.structures.manage'));
  canPay = computed(() => this.auth.hasPermission('fees.payments.record'));
  canVoid = computed(() => this.auth.hasPermission('fees.payments.record'));

  // ── CLASS-LEVEL AGGREGATES (computed from roster) ─────────────────────────
  // Note: StudentForPayment has: totalOriginal, totalConcession, totalAssigned, totalPaid, balance
  // totalAssigned = totalOriginal - totalConcession (effective amount due)
  // balance = totalAssigned - totalPaid

  /** Total original fee (before concessions) across all students */
  classTotalOriginal = computed(() => this.students().reduce((s, st) => s + st.totalOriginal, 0));

  /** Total concessions granted across all students */
  classTotalConcession = computed(() =>
    this.students().reduce((s, st) => s + st.totalConcession, 0)
  );

  /** Total effective amount due (after concessions) */
  classTotalDue = computed(() => this.students().reduce((s, st) => s + st.totalAssigned, 0));

  /** Total collected */
  classTotalCollected = computed(() => this.students().reduce((s, st) => s + st.totalPaid, 0));

  /** Total outstanding (unpaid balance) */
  classTotalOutstanding = computed(() =>
    this.students().reduce((s, st) => s + Math.max(0, st.balance), 0)
  );

  /** Collection rate percentage */
  classCollectionRate = computed(() => {
    const due = this.classTotalDue();
    if (due <= 0) return 100;
    return Math.round((this.classTotalCollected() / due) * 100);
  });

  /** Count of fully paid students */
  get paidCount(): number {
    return this.students().filter((s) => s.balance <= 0).length;
  }

  /** Count of students with pending balance */
  get pendingCount(): number {
    return this.students().filter((s) => s.balance > 0 && s.totalPaid === 0).length;
  }

  /** Count of students with partial payment */
  get partialCount(): number {
    return this.students().filter((s) => s.balance > 0 && s.totalPaid > 0).length;
  }

  /** Total outstanding */
  get totalOutstanding(): number {
    return this.classTotalOutstanding();
  }

  // ── STUDENT DUE FEES COMPUTED BREAKDOWN ───────────────────────────────────

  /** Standard fees total due for selected student */
  studentStandardDue = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.fees.reduce((s, f) => s + f.effectiveAmount, 0);
  });

  /** Standard fees paid for selected student */
  studentStandardPaid = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.fees.reduce((s, f) => s + f.paid, 0);
  });

  /** Standard fees concession for selected student */
  studentStandardConcession = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.fees.reduce((s, f) => s + f.concessionAmount, 0);
  });

  /** Custom fees total due for selected student */
  studentCustomDue = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.assignments.reduce((s, a) => s + a.effectiveAmount, 0);
  });

  /** Custom fees paid for selected student */
  studentCustomPaid = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.assignments.reduce((s, a) => s + a.paid, 0);
  });

  /** Custom fees concession for selected student */
  studentCustomConcession = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.assignments.reduce((s, a) => s + a.concessionAmount, 0);
  });

  /** Standard fees balance remaining */
  studentStandardBalance = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.fees.reduce((s, f) => s + f.remaining, 0);
  });

  /** Custom fees balance remaining */
  studentCustomBalance = computed(() => {
    const df = this.dueFees();
    if (!df) return 0;
    return df.assignments.reduce((s, a) => s + a.remaining, 0);
  });

  // ── Month-grouped standard fees (used by standard fees tab table) ─────────────
  standardFeeGroups = computed<StandardFeeMonthGroup[]>(() => {
    const df = this.dueFees();
    if (!df || !df.fees.length) return [];
    return this.buildStandardFeeGroups(df.fees);
  });

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDropdowns();
  }

  // ── Dropdown loaders ──────────────────────────────────────────────────────

  loadDropdowns(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years);
        const current = res.years.find((y) => y.isCurrent);
        if (current) this.selectedAcademicYearId.set(current.id);
      },
    });
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
  }

  // ── Class-section selection ───────────────────────────────────────────────

  onClassSectionChange(id: number | null): void {
    this.selectedClassSectionId.set(id);
    this.selectedStudent.set(null);
    this.dueFees.set(null);
    this.students.set([]);
    this.rosterSearch.set('');
    // Clear the balance cache when switching class-sections
    this.studentBalanceCache.set(new Map());
    if (id) this.loadRoster();
  }

  loadRoster(): void {
    const csId = this.selectedClassSectionId();
    if (!csId) return;
    this.loadingRoster.set(true);
    this.errorRoster.set(null);
    this.fees.getStudentsByClassSection(csId).subscribe({
      next: (list) => {
        this.students.set(list);
        this.loadingRoster.set(false);
      },
      error: (err) => {
        this.errorRoster.set(err?.error?.error ?? 'Failed to load students');
        this.loadingRoster.set(false);
      },
    });
  }

  // ── Student selection ─────────────────────────────────────────────────────

  selectStudent(student: StudentForPayment): void {
    this.selectedStudent.set(student);
    this.loadDueFees(student.enrollmentId);
  }

  isSelected(student: StudentForPayment): boolean {
    return this.selectedStudent()?.enrollmentId === student.enrollmentId;
  }

  loadDueFees(enrollmentId: number): void {
    this.loadingDueFees.set(true);
    this.dueFees.set(null);
    this.errorDueFees.set(null);
    this.fees.getDueFeesForEnrollment(enrollmentId).subscribe({
      next: (res) => {
        this.dueFees.set(res);
        this.loadingDueFees.set(false);

        // ── Update the per-student balance cache with the authoritative value ──
        // res.balanceDue = standard remaining + custom remaining (server-computed)
        // This is the only correct combined balance; update the cache map.
        const current = new Map(this.studentBalanceCache());
        current.set(enrollmentId, res.balanceDue);
        this.studentBalanceCache.set(current);
      },
      error: (err) => {
        this.errorDueFees.set(err?.error?.error ?? 'Failed to load fee overview');
        this.loadingDueFees.set(false);
      },
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Opens the payment dialog.
   *
   * When called with a specific `feeItem` (from a standard fee row's pay button),
   * the dialog opens in 'structure-wise' mode with that fee pre-selected.
   *
   * When called without arguments (from the student header "Pay Now" button),
   * the dialog opens in 'all' mode showing every outstanding fee.
   */
  openRecordPayment(feeItem?: DueFeeItem): void {
    const student = this.selectedStudent();
    if (!student) return;

    const cs = this.classSections().find((c) => c.id === this.selectedClassSectionId());

    const dialogData: any = {
      enrollmentId: student.enrollmentId,
      studentName: student.name,
      className: cs?.className,
      sectionName: cs?.sectionName,
    };

    // Structure-wise mode: only this fee
    if (feeItem) {
      dialogData['preselectedFeeStructureId'] = feeItem.id;
    }

    const ref = this.dialog.open(RecordPaymentComponent, {
      width: '820px',
      maxWidth: '96vw',
      panelClass: 'payment-dialog',
      data: dialogData,
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        // Refresh balances — result dialog is already shown by RecordPaymentComponent
        this.refreshStudent(student);
      }
    });
  }

  /**
   * Opens the concession form dialog.
   *
   * @param mode    'STRUCTURE' for standard fees, 'ASSIGNMENT' for custom fees.
   * @param feeItem Optional. When passed (by clicking the concession icon on a
   *                specific fee row), the form opens pre-targeted to that fee.
   *
   * Payment-state guards (evaluated in priority order):
   *
   *   1. Fully paid (remaining === 0, no concession yet)
   *      → isPaid=true — form shows paid-blocking state (cannot grant).
   *
   *   2. Partially paid (paid > 0 but remaining > 0, no concession yet)
   *      → isPartiallyPaid=true — form shows partial-pay blocking state (cannot grant).
   *      amountPaid and effectiveAmount are forwarded so the blocking UI can
   *      display the exact amounts already collected.
   *
   *   3. Fee has an active concession AND is fully settled (remaining === 0)
   *      → isPaid=true — form shows the locked-concession banner (cannot revoke).
   *
   *   4. Fee has an active concession but still has remaining balance
   *      → no flags set — form shows the existing-concession management UI.
   *
   *   5. No payment, no concession
   *      → no flags set — form shows the grant-concession form.
   *
   * Note: cases 1–3 use `remaining <= 0` or `paid > 0` on the DueFeeItem,
   * which already accounts for any existing concession in its effectiveAmount.
   */
  openGrantConcession(mode: 'STRUCTURE' | 'ASSIGNMENT', feeItem?: DueFeeItem): void {
    const student = this.selectedStudent();
    if (!student) return;

    // ── Determine payment state for this fee item ─────────────────────────
    const isPaid = feeItem ? feeItem.remaining <= 0 : false;

    // Partially paid: a payment exists but the balance is not yet cleared.
    // Only meaningful when a specific feeItem is clicked (not header-level action).
    const isPartiallyPaid = feeItem ? feeItem.paid > 0 && feeItem.remaining > 0 : false;

    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: student.enrollmentId,
        studentName: student.name,
        mode,
        isPaid,
        isPartiallyPaid,
        // ── Pass payment amounts for the partial-pay blocking UI ─────────
        // Only relevant when isPartiallyPaid=true; harmless otherwise.
        ...(feeItem ? { amountPaid: feeItem.paid, effectiveAmount: feeItem.effectiveAmount } : {}),
        // ── Preselected fee IDs ──────────────────────────────────────────
        // Pass exactly ONE of these so the form:
        //   a) hides the fee-selector dropdown (compact mode pill)
        //   b) auto-selects the fee after its list is loaded
        //   c) immediately checks for an existing concession
        // Never pass both — backend schema forbids it.
        ...(feeItem && mode === 'STRUCTURE' ? { preselectedFeeStructureId: feeItem.id } : {}),
        ...(feeItem && mode === 'ASSIGNMENT' ? { preselectedAssignmentId: feeItem.id } : {}),
      },
    });

    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.snack.open('Concession granted successfully', 'Close', { duration: 3000 });
        this.refreshStudent(student);
      }
    });
  }

  onChildChanged(): void {
    const student = this.selectedStudent();
    if (student) this.refreshStudent(student);
  }

  private refreshStudent(student: StudentForPayment): void {
    this.loadDueFees(student.enrollmentId);
    this.loadRoster();
  }

  // ── Public helpers for template ───────────────────────────────────────────

  /**
   * Returns the true combined balance for a student card in the roster.
   *
   * Priority:
   *   1. Cached value from getDueFeesForEnrollment (standard + custom, server-authoritative)
   *   2. Fall back to StudentForPayment.balance (standard only — shown with a visual cue)
   *
   * The cache is populated the first time a student is selected and updated after
   * every payment / concession change.
   */
  getCombinedBalance(student: StudentForPayment): number {
    const cached = this.studentBalanceCache().get(student.enrollmentId);
    // Return cached authoritative value if available
    if (cached !== undefined) return cached;
    // Fallback: StudentForPayment.balance may under-report if student has custom fees.
    // We return it as-is; the template shows a "+" indicator when the cache is absent.
    return student.balance;
  }

  /**
   * True when we have loaded the authoritative combined balance for this student.
   * Used by the template to show/hide the "includes custom fees" indicator.
   */
  hasCachedBalance(student: StudentForPayment): boolean {
    return this.studentBalanceCache().has(student.enrollmentId);
  }

  /**
   * True when the authoritative combined balance differs from the roster balance.
   * Signals the student has custom fees not reflected in the roster card's .balance.
   */
  hasCustomFees(student: StudentForPayment): boolean {
    const cached = this.studentBalanceCache().get(student.enrollmentId);
    if (cached === undefined) return false;
    // Difference of more than 1 paisa means custom fees exist
    return Math.abs(cached - student.balance) > 1;
  }

  balanceClass(balance: number): string {
    if (balance <= 0) return 'balance--paid';
    if (balance > 0) return 'balance--due';
    return '';
  }

  /**
   * Derives a FeeStatus value from a DueFeeItem for display in the standard
   * fees table status column.
   *
   * Logic:
   *   PAID     — effective amount > 0 and nothing remains (fully settled)
   *   PARTIAL  — some amount has been collected but balance remains
   *   OVERDUE  — no payment at all AND due date has passed today's date
   *   PENDING  — no payment and either no due date or due date is in the future
   *
   * Zero-amount fees (effectiveAmount === 0 after a 100% concession) are
   * treated as PAID since there is nothing left to collect.
   */
  getFeeItemStatus(fee: DueFeeItem): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' {
    // Fully conceded or fully settled
    if (fee.remaining <= 0) return 'PAID';

    // Partial payment exists
    if (fee.paid > 0) return 'PARTIAL';

    // No payment — check overdue
    if (fee.dueDate) {
      const due = new Date(fee.dueDate);
      due.setHours(23, 59, 59, 999); // end of due day
      if (due < new Date()) return 'OVERDUE';
    }

    return 'PENDING';
  }

  statusIcon(student: StudentForPayment): string {
    const balance = this.getCombinedBalance(student);
    if (balance <= 0) return 'check_circle';
    if (student.totalPaid > 0) return 'schedule';
    return 'radio_button_unchecked';
  }

  statusIconClass(student: StudentForPayment): string {
    const balance = this.getCombinedBalance(student);
    if (balance <= 0) return 'icon--paid';
    if (student.totalPaid > 0) return 'icon--partial';
    return 'icon--pending';
  }

  collectionRate(student: StudentForPayment): number {
    // Use cached combined balance for the progress bar denominator
    const cached = this.studentBalanceCache().get(student.enrollmentId);
    if (cached !== undefined) {
      // totalPaid from roster is still correct (payments are the same either way)
      const totalDue = student.totalPaid + Math.max(0, cached);
      if (totalDue <= 0) return 100;
      return Math.round((student.totalPaid / totalDue) * 100);
    }
    // Fallback to roster-level data
    if (student.totalAssigned <= 0) return 100;
    return Math.round((student.totalPaid / student.totalAssigned) * 100);
  }

  selectedClassSectionLabel(): string {
    const csId = this.selectedClassSectionId();
    if (!csId) return '';
    const cs = this.classSections().find((c) => c.id === csId);
    return cs ? `${cs.className} – ${cs.sectionName}` : '';
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

  trackByFeeGroup(_: number, group: StandardFeeMonthGroup): string {
    return group.monthKey ?? '__one_time__';
  }

  trackByFeeItem(_: number, item: DueFeeItem): number {
    return item.id;
  }

  trackById(_: number, item: StudentForPayment): number {
    return item.enrollmentId;
  }

  private buildStandardFeeGroups(fees: DueFeeItem[]): StandardFeeMonthGroup[] {
    if (!fees.length) return [];

    const groups: StandardFeeMonthGroup[] = [];
    let currentKey: string | null | undefined = undefined;
    let currentItems: DueFeeItem[] = [];

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
