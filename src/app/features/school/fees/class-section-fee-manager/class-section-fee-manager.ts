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

  openGrantConcession(mode: 'STRUCTURE' | 'ASSIGNMENT'): void {
    const student = this.selectedStudent();
    if (!student) return;

    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: student.enrollmentId,
        studentName: student.name,
        mode,
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  balanceClass(balance: number): string {
    if (balance <= 0) return 'balance--paid';
    if (balance > 0) return 'balance--due';
    return '';
  }

  statusIcon(student: StudentForPayment): string {
    if (student.balance <= 0) return 'check_circle';
    if (student.totalPaid > 0) return 'schedule';
    return 'radio_button_unchecked';
  }

  statusIconClass(student: StudentForPayment): string {
    if (student.balance <= 0) return 'icon--paid';
    if (student.totalPaid > 0) return 'icon--partial';
    return 'icon--pending';
  }

  collectionRate(student: StudentForPayment): number {
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
