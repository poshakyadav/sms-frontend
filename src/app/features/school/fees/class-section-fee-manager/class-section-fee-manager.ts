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

  openRecordPayment(): void {
    const student = this.selectedStudent();
    if (!student) return;

    const cs = this.classSections().find((c) => c.id === this.selectedClassSectionId());

    const ref = this.dialog.open(RecordPaymentComponent, {
      width: '820px',
      maxWidth: '96vw',
      panelClass: 'payment-dialog',
      data: {
        enrollmentId: student.enrollmentId,
        studentName: student.name,
        className: cs?.className,
        sectionName: cs?.sectionName,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.snack.open(
          `Payment recorded — ${result.meta?.receiptNumbers?.join(', ') ?? ''}`,
          'Close',
          { duration: 4000, panelClass: 'success-toast' }
        );
        this.refreshStudent(student);
      }
    });
  }

  /**
   * Opens the concession form.
   *
   * @param mode    'STRUCTURE' for standard fees, 'ASSIGNMENT' for custom fees.
   * @param feeItem Optional. When passed (by clicking the concession icon on a
   *                specific fee row), the form will open with that fee
   *                pre-selected and show the existing-concession banner if one
   *                already exists.
   *
   * passes `isPaid` so the form can lock "Revoke & Replace" when the
   *      fee is already fully settled (remaining === 0).
   * custom-fee branch now correctly uses `preselectedAssignmentId`
   *      AND the timing-safe patch in `loadData()` ensures auto-select
   *      fires AFTER the assignments list is populated.
   */
  openGrantConcession(mode: 'STRUCTURE' | 'ASSIGNMENT', feeItem?: DueFeeItem): void {
    const student = this.selectedStudent();
    if (!student) return;

    // ── Is this fee fully settled? ───────────────────────────────────────
    // remaining <= 0 means the student has already paid the effective amount.
    // Revoking a concession on a paid fee would retroactively increase the
    // outstanding balance — block it at the UI level.
    const isPaid = feeItem ? feeItem.remaining <= 0 : false;

    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: student.enrollmentId,
        studentName: student.name,
        mode,
        isPaid,
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

  trackById(_: number, item: StudentForPayment): number {
    return item.enrollmentId;
  }
}
