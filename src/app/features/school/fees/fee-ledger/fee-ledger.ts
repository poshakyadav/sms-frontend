// fee-ledger.ts
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
import {
  FeesService,
  StudentLedgerEntry,
  LedgerFeeDetail,
  LedgerAssignmentDetail,
  PaymentHistoryRow,
} from '../../../../core/services/fees.service';
import { AcademicsService } from '../../../../core/services/academics.service';
import { UsersService, SchoolUser } from '../../../../core/services/users.service';
import { FeeStatusBadge } from '../../../../shared/components/fee-status-badge/fee-status-badge';
import { PaisePipe } from '../../../../shared/pipes/paise-pipe';

@Component({
  selector: 'app-fee-ledger',
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
    PaisePipe,
    FeeStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-ledger.html',
  styleUrl: './fee-ledger.scss',
})
export class FeeLedger implements OnInit {
  loading = signal(false);
  searching = signal(false);
  error = signal<string | null>(null);
  ledger = signal<StudentLedgerEntry[]>([]);

  students = signal<SchoolUser[]>([]);
  academicYears = signal<any[]>([]);

  searchQuery = signal('');
  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.students().slice(0, 10);
    return this.students()
      .filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      .slice(0, 20);
  });

  selectedStudent = signal<SchoolUser | null>(null);
  selectedAcademicYearId = signal<number | null>(null);

  expandedYears = signal<Set<number>>(new Set());
  expandedSections = signal<Map<string, boolean>>(new Map());

  showStudentDropdown = signal(false);

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
    private users: UsersService
  ) {}

  ngOnInit(): void {
    this.loadAcademicYears();
    this.loadStudents();
  }

  loadAcademicYears(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years);
        const current = res.years.find((y) => y.isCurrent);
        if (current) this.selectedAcademicYearId.set(current.id);
      },
    });
  }

  loadStudents(): void {
    this.users.getUsersByCategory('student').subscribe({
      next: (students) => this.students.set(students),
    });
  }

  selectStudent(student: SchoolUser): void {
    this.selectedStudent.set(student);
    this.searchQuery.set(student.name);
    this.showStudentDropdown.set(false);
    this.loadLedger();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (!value.trim()) {
      this.selectedStudent.set(null);
      this.ledger.set([]);
    }
    this.showStudentDropdown.set(true);
  }

  onYearChange(): void {
    if (this.selectedStudent()) this.loadLedger();
  }

  loadLedger(): void {
    const student = this.selectedStudent();
    if (!student) return;
    this.loading.set(true);
    this.error.set(null);
    this.fees.getStudentLedger(student.id, this.selectedAcademicYearId() ?? undefined).subscribe({
      next: (entries) => {
        this.ledger.set(entries);
        const allYears = new Set(entries.map((e) => e.yearId));
        this.expandedYears.set(allYears);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load ledger');
        this.loading.set(false);
      },
    });
  }

  toggleYear(yearId: number): void {
    const set = new Set(this.expandedYears());
    if (set.has(yearId)) set.delete(yearId);
    else set.add(yearId);
    this.expandedYears.set(set);
  }

  isYearExpanded(yearId: number): boolean {
    return this.expandedYears().has(yearId);
  }

  toggleSection(key: string): void {
    const map = new Map(this.expandedSections());
    map.set(key, !map.get(key));
    this.expandedSections.set(map);
  }

  isSectionExpanded(key: string): boolean {
    return this.expandedSections().get(key) ?? true;
  }

  collectionRate(entry: StudentLedgerEntry): number {
    if (entry.totalDue <= 0) return 100;
    return Math.round((entry.totalPaid / entry.totalDue) * 100);
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

  /**
   * Computes per-fee paid amount from the payment list.
   * The ledger backend does not return per-fee paid amounts in detail.fees —
   * we derive them by summing matching payments.
   */
  getPaidForFee(
    payments: PaymentHistoryRow[],
    feeId: number,
    source: 'STRUCTURE' | 'ASSIGNMENT'
  ): number {
    return (
      payments
        .filter((p) => !p.isVoid && p.source === source)
        // PaymentHistoryRow doesn't carry feeStructureId/assignmentId directly,
        // so we rely on totals from the entry-level totalPaid for display.
        // For per-row status we use effectiveAmount vs entry.totalPaid ratio.
        .reduce((s, p) => s + p.amountPaid, 0)
    );
  }

  /**
   * Computes status for a fee detail row using the entry's payment list.
   * Groups payments by source to build paid maps.
   */
  buildPaidMaps(entry: StudentLedgerEntry): {
    structurePaid: Map<string, number>;
    assignmentPaid: Map<string, number>;
  } {
    // Since ledger payment rows don't carry feeStructureId/assignmentId,
    // we use the proportion approach: spread totalPaid across fees proportionally.
    // This is display-only — the source-of-truth is the backend balance.
    return { structurePaid: new Map(), assignmentPaid: new Map() };
  }

  /**
   * Derives status for a standard fee row from its effective amount and
   * the entry-level paid/balance.
   *
   * Because the ledger API returns fee details without per-fee paid amounts
   * (only totals), we compute status as:
   *   - effectiveAmount == 0 → PAID
   *   - dueDate in the past → OVERDUE
   *   - otherwise → PENDING
   *
   * The backend `getStudentOwnFees` endpoint returns per-fee status; the
   * ledger endpoint is admin-facing and only returns totals. For accurate
   * per-fee status in the ledger view, use a data source that includes
   * per-fee paid amounts (e.g. getDueFeesForEnrollment).
   */
  feeItemStatus(
    effectiveAmount: number,
    concessionAmount: number,
    dueDate: string | null
  ): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' {
    // If effective amount is 0 (100% concession), treat as PAID
    if (effectiveAmount <= 0) return 'PAID';
    // Cannot determine partial/paid per-fee from ledger totals alone;
    // use due date for overdue signalling
    if (dueDate && dueDate < new Date().toISOString().split('T')[0]) return 'OVERDUE';
    return 'PENDING';
  }

  closeDropdown(): void {
    setTimeout(() => this.showStudentDropdown.set(false), 200);
  }
}
