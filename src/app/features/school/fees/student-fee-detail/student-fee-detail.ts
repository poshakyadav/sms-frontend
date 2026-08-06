// features/school/fees/student-fee-detail/student-fee-detail.ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

import { AcademicsService } from '../../../../core/services/academics.service';
import {
  DueFeesResponse,
  FeesService,
  StudentLedgerEntry,
} from '../../../../core/services/fees.service';
import { SchoolUser, UsersService } from '../../../../core/services/users.service';
import { DueFeesPanel } from '../../../../shared/components/due-fees-panel/due-fees-panel';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';
import { AssignmentsList } from '../fee-assignments/assignments-list/assignments-list';
import { ConcessionsFormComponent } from '../fee-concessions/concessions-form/concessions-form';
import { ConcessionsList } from '../fee-concessions/concessions-list/concessions-list';
import { PaymentHistory } from '../payments/payment-history/payment-history';
import { RecordPaymentComponent } from '../payments/record-payment/record-payment';

// ── Local enrollment summary type (built from ledger entries) ─────────────────
export interface EnrollmentSummary {
  id: number | null; // enrollmentId — may be null if ledger doesn't expose it
  academicYearId: number;
  academicYearName: string;
  className: string;
  sectionName: string;
  rollNumber: string | null;
  totalDue: number;
  totalPaid: number;
  balance: number;
  collectionRate: number;
}

@Component({
  selector: 'app-student-fee-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    PaisePipe,
    DueFeesPanel,
    AssignmentsList,
    ConcessionsList,
    PaymentHistory,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-fee-detail.html',
  styleUrl: './student-fee-detail.scss',
})
export class StudentFeeDetail implements OnInit, OnDestroy {
  // ── Search state ──────────────────────────────────────────────────────────
  searchQuery = signal('');
  searching = signal(false);
  students = signal<SchoolUser[]>([]);
  showDropdown = signal(false);

  // ── Selected data ─────────────────────────────────────────────────────────
  selectedStudent = signal<SchoolUser | null>(null);
  selectedEnrollment = signal<EnrollmentSummary | null>(null);
  enrollments = signal<EnrollmentSummary[]>([]);
  loadingEnrollments = signal(false);
  errorEnrollments = signal<string | null>(null);

  academicYears = signal<any[]>([]);

  // ── RxJS teardown ─────────────────────────────────────────────────────────
  private destroy$ = new Subject<void>();
  private searchInput$ = new Subject<string>();

  // ── Computed helpers ──────────────────────────────────────────────────────
  /** The active enrollment's id — null-safe for template */
  activeEnrollmentId = computed(() => this.selectedEnrollment()?.id ?? null);

  /** True when an enrollment is selected AND it has a valid id */
  hasValidEnrollment = computed(
    () => this.selectedEnrollment() !== null && this.selectedEnrollment()!.id !== null
  );

  constructor(
    private fees: FeesService,
    private users: UsersService,
    private academics: AcademicsService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadAcademicYears();
    this.setupSearch();

    // FIX: deep-linking uses queryParams, not route params
    // The component writes ?studentId=X via queryParamsHandling:'merge'
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params['studentId'];
      if (id && !this.selectedStudent()) {
        this.loadStudentById(+id);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private setupSearch(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => this.performSearch(query));
  }

  private loadAcademicYears(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years),
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (!value.trim()) {
      this.students.set([]);
      this.showDropdown.set(false);
      return;
    }
    this.searchInput$.next(value.trim());
  }

  private performSearch(query: string): void {
    this.searching.set(true);
    this.users.getUsersByCategory('student').subscribe({
      next: (all) => {
        const q = query.toLowerCase();
        const filtered = all
          .filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.email ?? '').toLowerCase().includes(q) ||
              s.username.toLowerCase().includes(q)
          )
          .slice(0, 15);
        this.students.set(filtered);
        this.showDropdown.set(true);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  // FIX: made public so template retry button can call it; renamed for clarity
  loadStudentById(studentId: number): void {
    this.users.getUserById(studentId).subscribe({
      next: (student) => {
        this.selectedStudent.set(student);
        this.searchQuery.set(student.name);
        this.showDropdown.set(false);
        this.loadEnrollments(student.id);
      },
      error: () => {
        // Student not found — clear any stale query param
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      },
    });
  }

  selectStudent(student: SchoolUser): void {
    this.selectedStudent.set(student);
    this.searchQuery.set(student.name);
    this.showDropdown.set(false);
    this.students.set([]);
    this.selectedEnrollment.set(null);
    this.enrollments.set([]);
    this.loadEnrollments(student.id);

    // Persist studentId in URL for bookmarking / page refresh
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { studentId: student.id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.selectedStudent.set(null);
    this.selectedEnrollment.set(null);
    this.enrollments.set([]);
    this.students.set([]);
    this.showDropdown.set(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  closeDropdown(): void {
    // Small delay so mousedown on a dropdown item fires before blur hides it
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  // ── Enrollments ───────────────────────────────────────────────────────────

  private loadEnrollments(studentId: number): void {
    this.loadingEnrollments.set(true);
    this.errorEnrollments.set(null);

    this.fees.getStudentLedger(studentId).subscribe({
      next: (ledger: StudentLedgerEntry[]) => {
        const enrollments: EnrollmentSummary[] = ledger.map((entry) => {
          // StudentLedgerEntry does not expose enrollmentId directly.
          // We derive it from the first non-void payment record if present,
          // otherwise null (the tab panel guards on hasValidEnrollment).
          const firstPayment = entry.details?.payments?.[0] as any;
          const enrollmentId: number | null =
            (entry as any).enrollmentId ?? firstPayment?.enrollmentId ?? null;

          return {
            id: enrollmentId,
            academicYearId: entry.yearId,
            academicYearName: entry.academicYearName,
            className: entry.className,
            sectionName: entry.sectionName,
            rollNumber: entry.rollNumber,
            totalDue: entry.totalDue,
            totalPaid: entry.totalPaid,
            balance: entry.balance,
            collectionRate:
              entry.totalDue > 0 ? Math.round((entry.totalPaid / entry.totalDue) * 100) : 100,
          };
        });

        this.enrollments.set(enrollments);

        // Preserve selection if the same year is still present;
        // otherwise default to the first (most-recent) entry.
        const prev = this.selectedEnrollment();
        if (prev) {
          const match = enrollments.find((e) => e.academicYearId === prev.academicYearId);
          this.selectedEnrollment.set(match ?? enrollments[0] ?? null);
        } else {
          this.selectedEnrollment.set(enrollments[0] ?? null);
        }

        this.loadingEnrollments.set(false);
      },

      error: () => {
        // Fallback: use academics enrollments endpoint which does expose enrollmentId
        this.academics.getEnrollments().subscribe({
          next: (res) => {
            const studentEnrollments: EnrollmentSummary[] = res.enrollments
              .filter((e) => e.studentId === studentId)
              .map((e) => ({
                id: e.id,
                academicYearId: 0, // not available from this endpoint
                academicYearName: '—',
                className: e.className,
                sectionName: e.sectionName,
                rollNumber: e.rollNumber ?? null,
                totalDue: 0,
                totalPaid: 0,
                balance: 0,
                collectionRate: 0,
              }));

            this.enrollments.set(studentEnrollments);
            const prev = this.selectedEnrollment();
            if (prev) {
              const match = studentEnrollments.find((e) => e.id === prev.id);
              this.selectedEnrollment.set(match ?? studentEnrollments[0] ?? null);
            } else {
              this.selectedEnrollment.set(studentEnrollments[0] ?? null);
            }
            this.loadingEnrollments.set(false);
          },
          error: (err2) => {
            this.errorEnrollments.set(err2?.error?.error ?? 'Failed to load enrollments');
            this.loadingEnrollments.set(false);
          },
        });
      },
    });
  }

  selectEnrollment(enrollment: EnrollmentSummary): void {
    this.selectedEnrollment.set(enrollment);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  openRecordPayment(): void {
    const enrollment = this.selectedEnrollment();
    const student = this.selectedStudent();
    if (!enrollment?.id || !student) return;

    const ref = this.dialog.open(RecordPaymentComponent, {
      width: '820px',
      maxWidth: '96vw',
      panelClass: 'payment-dialog',
      data: {
        enrollmentId: enrollment.id,
        studentName: student.name,
        className: enrollment.className,
        sectionName: enrollment.sectionName,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.snack.open(
          `Payment recorded — ${result.meta?.receiptNumbers?.join(', ') ?? ''}`,
          'Close',
          { duration: 4000, panelClass: 'success-toast' }
        );
        this.refreshCurrentEnrollment();
      }
    });
  }

  openAddConcession(): void {
    const enrollment = this.selectedEnrollment();
    const student = this.selectedStudent();
    if (!enrollment?.id || !student) return;

    const ref = this.dialog.open(ConcessionsFormComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: {
        enrollmentId: enrollment.id,
        studentName: student.name,
      },
    });

    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.snack.open('Concession granted', 'Close', { duration: 3000 });
        this.refreshCurrentEnrollment();
      }
    });
  }

  onPayNow(event: { enrollmentId: number; dueFees: DueFeesResponse }): void {
    const student = this.selectedStudent();
    const enrollment = this.selectedEnrollment();

    const ref = this.dialog.open(RecordPaymentComponent, {
      width: '820px',
      maxWidth: '96vw',
      panelClass: 'payment-dialog',
      data: {
        enrollmentId: event.enrollmentId,
        studentName: student?.name,
        className: enrollment?.className,
        sectionName: enrollment?.sectionName,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.snack.open(
          `Payment recorded — ${result.meta?.receiptNumbers?.join(', ') ?? ''}`,
          'Close',
          { duration: 4000, panelClass: 'success-toast' }
        );
        this.refreshCurrentEnrollment();
      }
    });
  }

  onAssignmentsChanged(): void {
    this.refreshCurrentEnrollment();
  }

  // FIX: preserves current enrollment selection on refresh
  private refreshCurrentEnrollment(): void {
    const student = this.selectedStudent();
    if (!student) return;
    this.loadEnrollments(student.id);
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

  getCollectionRateColor(rate: number): string {
    if (rate >= 80) return 'var(--color-success)';
    if (rate >= 50) return 'var(--color-warning)';
    return 'var(--color-error)';
  }

  trackByStudent(_: number, s: SchoolUser): number {
    return s.id;
  }

  trackByEnrollment(_: number, e: EnrollmentSummary): number {
    return e.id ?? e.academicYearId;
  }
}
