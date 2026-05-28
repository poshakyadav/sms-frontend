// features/school/fees/fee-concessions/concessions-form/concessions-form.ts
import {
  Component,
  OnInit,
  Inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FeesService,
  FeeStructure,
  StudentFeeAssignment,
  FeeConcession,
  CreateConcessionPayload,
  paiseToRupees,
} from '../../../../../core/services/fees.service';

export interface ConcessionsFormData {
  enrollmentId: number;
  studentName?: string;
  /** Pre-select STRUCTURE or ASSIGNMENT mode */
  mode?: 'STRUCTURE' | 'ASSIGNMENT';
  /**
   * When provided, auto-selects this fee structure ID and skips the dropdown.
   */
  preselectedFeeStructureId?: number;
  /**
   * When provided, auto-selects this assignment ID and skips the dropdown.
   */
  preselectedAssignmentId?: number;
  /**
   * When true, fee is fully paid — concession grant should be blocked.
   * This covers BOTH cases:
   *   a) Fee has an active concession + is paid   → show locked-concession banner
   *   b) Fee has NO concession + is paid           → show paid-blocking state
   */
  isPaid?: boolean;
  /**
   * When true, fee has been partially paid (amountPaid > 0 but remaining > 0).
   * Concession grant is blocked because applying a discount after partial
   * payment would retroactively misrepresent what was owed at time of payment.
   *
   * Passed by the caller alongside amountPaid / effectiveAmount so the
   * blocking UI can show the exact amounts already collected.
   */
  isPartiallyPaid?: boolean;
  /**
   * Amount already collected (in paise). Only meaningful when isPartiallyPaid=true.
   * Shown in the partial-pay blocking UI so the admin understands the context.
   */
  amountPaid?: number;
  /**
   * Effective amount due after any existing concession (in paise).
   * Only meaningful when isPartiallyPaid=true.
   */
  effectiveAmount?: number;
}

@Component({
  selector: 'app-concessions-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concessions-form.html',
  styleUrl: './concessions-form.scss',
})
export class ConcessionsFormComponent implements OnInit {
  form!: FormGroup;
  saving = signal(false);
  loading = signal(false);
  revoking = signal(false);
  error = signal<string | null>(null);

  sourceMode = signal<'STRUCTURE' | 'ASSIGNMENT'>('STRUCTURE');

  structures = signal<FeeStructure[]>([]);
  assignments = signal<StudentFeeAssignment[]>([]);

  selectedBaseAmount = signal<number>(0);

  existingConcession = signal<FeeConcession | null>(null);
  editMode = signal(false);
  isPaid = signal(false);

  /**
   * True when the fee has been partially paid (some amount collected but
   * balance still remains). Concessions are blocked in this state because
   * they would retroactively change what was owed at the time payment was made.
   */
  isPartiallyPaid = signal(false);

  /**
   * True once concession-check has resolved and we have confirmed there is
   * no active concession. Until then we can't distinguish "no concession yet"
   * from "concession check still pending".
   */
  concessionCheckDone = signal(false);

  /** Tracks focus on the custom amount input for border highlighting */
  amountInputFocused = false;

  /**
   * Derived blocking state:
   * Fee is fully paid AND has no active concession → adding a concession
   * on an already-settled fee makes no financial sense and is blocked.
   *
   * This is separate from the "paid + has concession" case, which shows the
   * locked-concession banner inside the existing concession block.
   */
  isPaidWithNoConession = computed(
    () =>
      this.isPaid() &&
      this.concessionCheckDone() &&
      !this.existingConcession() &&
      this.selectedBaseAmount() > 0
  );

  /**
   * Derived blocking state:
   * Fee has been partially paid but not yet fully settled.
   * Granting a concession now would retroactively lower the effective amount
   * below what was already collected — disallowed as a data integrity rule.
   *
   * Only active when concession check has resolved so we don't show the
   * blocker before we know whether an existing concession exists (which
   * would have already been factored into the balance).
   */
  isPartiallyPaidBlocked = computed(
    () =>
      this.isPartiallyPaid() &&
      this.concessionCheckDone() &&
      !this.existingConcession() &&
      this.selectedBaseAmount() > 0
  );

  previewDiscount = computed(() => {
    const type = this.form?.get('concessionType')?.value;
    const value = this.form?.get('concessionValue')?.value;
    const base = this.selectedBaseAmount();
    if (!base || !value || value <= 0) return null;
    let discount = 0;
    if (type === 'PERCENTAGE') {
      discount = Math.floor((base * value) / 100);
    } else {
      discount = Math.round(value * 100);
    }
    const effective = Math.max(0, base - discount);
    return { discount, effective, base };
  });

  selectedFeeLabel = computed(() => {
    const mode = this.sourceMode();
    if (mode === 'STRUCTURE') {
      const id = this.form?.get('feeStructureId')?.value;
      const s = this.structures().find((x) => x.id === id);
      return s ? this.formatFeeLabel(s) : '';
    } else {
      const id = this.form?.get('studentFeeAssignmentId')?.value;
      const a = this.assignments().find((x) => x.id === id);
      return a ? this.formatAssignmentLabel(a) : '';
    }
  });

  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    private cdr: ChangeDetectorRef,
    public dialogRef: MatDialogRef<ConcessionsFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConcessionsFormData
  ) {}

  ngOnInit(): void {
    if (this.data.mode) this.sourceMode.set(this.data.mode);
    if (this.data.isPaid) this.isPaid.set(true);
    if (this.data.isPartiallyPaid) this.isPartiallyPaid.set(true);
    this.buildForm();
    this.loadData();
  }

  buildForm(): void {
    this.form = this.fb.group({
      feeStructureId: [null],
      studentFeeAssignmentId: [null],
      concessionType: ['PERCENTAGE', Validators.required],
      concessionValue: [null, [Validators.required, Validators.min(1)]],
      reason: ['', [Validators.required, Validators.minLength(5)]],
    });

    this.form.get('feeStructureId')?.valueChanges.subscribe((id) => {
      if (id) {
        const s = this.structures().find((x) => x.id === id);
        this.selectedBaseAmount.set(s?.amount ?? 0);
        this.concessionCheckDone.set(false);
        this.checkExistingConcession('STRUCTURE', id);
      } else {
        this.selectedBaseAmount.set(0);
        this.existingConcession.set(null);
        this.concessionCheckDone.set(false);
        this.editMode.set(false);
      }
    });

    this.form.get('studentFeeAssignmentId')?.valueChanges.subscribe((id) => {
      if (id) {
        const a = this.assignments().find((x) => x.id === id);
        this.selectedBaseAmount.set(a?.amount ?? 0);
        this.concessionCheckDone.set(false);
        this.checkExistingConcession('ASSIGNMENT', id);
      } else {
        this.selectedBaseAmount.set(0);
        this.existingConcession.set(null);
        this.concessionCheckDone.set(false);
        this.editMode.set(false);
      }
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    if (this.sourceMode() === 'STRUCTURE') {
      this.fees.getFeeStructures().subscribe({
        next: (list) => {
          this.structures.set(list);
          this.loading.set(false);

          // CRITICAL: patch AFTER structures signal is set so valueChanges
          // listener can resolve the structure from the list.
          if (this.data.preselectedFeeStructureId) {
            this.form.patchValue({ feeStructureId: this.data.preselectedFeeStructureId });
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error.set(this.extractErrorMessage(err, 'Failed to load fee structures'));
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
    } else {
      // ASSIGNMENT mode
      this.fees.getStudentFeeAssignments(this.data.enrollmentId, false).subscribe({
        next: (list) => {
          this.assignments.set(list);
          this.loading.set(false);

          // CRITICAL: patch AFTER assignments signal is set so valueChanges
          // listener can resolve the assignment from the list.
          if (this.data.preselectedAssignmentId) {
            this.form.patchValue({
              studentFeeAssignmentId: this.data.preselectedAssignmentId,
            });
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error.set(this.extractErrorMessage(err, 'Failed to load fee assignments'));
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
    }
  }

  private checkExistingConcession(mode: 'STRUCTURE' | 'ASSIGNMENT', selectedId: number): void {
    this.existingConcession.set(null);
    this.editMode.set(false);
    this.concessionCheckDone.set(false);

    this.fees.getConcessionsForEnrollment(this.data.enrollmentId).subscribe({
      next: (concessions) => {
        const active = concessions.find((c) => {
          if (!c.isActive) return false;
          if (mode === 'STRUCTURE') return c.feeStructureId === selectedId;
          return c.studentFeeAssignmentId === selectedId;
        });
        this.existingConcession.set(active ?? null);
        this.concessionCheckDone.set(true);
        this.cdr.markForCheck();
      },
      error: () => {
        // Non-fatal — mark check done so the UI can resolve its state
        this.concessionCheckDone.set(true);
        this.cdr.markForCheck();
      },
    });
  }

  setMode(mode: 'STRUCTURE' | 'ASSIGNMENT'): void {
    this.sourceMode.set(mode);
    this.form.patchValue({
      feeStructureId: null,
      studentFeeAssignmentId: null,
      concessionValue: null,
    });
    this.selectedBaseAmount.set(0);
    this.existingConcession.set(null);
    this.concessionCheckDone.set(false);
    this.editMode.set(false);
    this.loadData();
  }

  setConcessionType(type: 'PERCENTAGE' | 'FIXED'): void {
    this.form.patchValue({ concessionType: type, concessionValue: null });
  }

  revokeAndReplace(): void {
    const existing = this.existingConcession();
    if (!existing) return;

    this.revoking.set(true);
    this.error.set(null);

    this.fees.revokeConcession(existing.id).subscribe({
      next: () => {
        this.revoking.set(false);
        this.existingConcession.set(null);
        this.editMode.set(false);
        this.form.patchValue({ concessionValue: null, reason: '' });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error.set(this.extractErrorMessage(err, 'Failed to revoke concession'));
        this.revoking.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const isStructure = this.sourceMode() === 'STRUCTURE';

    if (isStructure && !v.feeStructureId) {
      this.error.set('Please select a fee structure');
      return;
    }
    if (!isStructure && !v.studentFeeAssignmentId) {
      this.error.set('Please select a custom fee assignment');
      return;
    }

    if (this.selectedBaseAmount() <= 0) {
      this.error.set('Selected fee has no amount — cannot apply concession');
      return;
    }

    // ── Build strictly-typed discriminated union payload ────────────────────
    // CRITICAL: never include both feeStructureId AND studentFeeAssignmentId.
    // The backend Zod schema (and service layer) reject requests with both set.
    const payload: CreateConcessionPayload = isStructure
      ? {
          enrollmentId: this.data.enrollmentId,
          feeStructureId: v.feeStructureId,
          concessionType: v.concessionType,
          concessionValue:
            v.concessionType === 'FIXED' ? Math.round(v.concessionValue * 100) : v.concessionValue,
          reason: v.reason.trim(),
        }
      : {
          enrollmentId: this.data.enrollmentId,
          studentFeeAssignmentId: v.studentFeeAssignmentId,
          concessionType: v.concessionType,
          concessionValue:
            v.concessionType === 'FIXED' ? Math.round(v.concessionValue * 100) : v.concessionValue,
          reason: v.reason.trim(),
        };

    this.saving.set(true);
    this.error.set(null);

    this.fees.createConcession(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.error.set(this.extractErrorMessage(err, 'Failed to grant concession'));
        this.saving.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Error extraction ───────────────────────────────────────────────────────
  private extractErrorMessage(err: any, fallback: string): string {
    const body = err?.error;

    if (!body) return err?.message ?? fallback;

    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;

    if (body.error && typeof body.error === 'object') {
      const issues = body.error?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        return issues.map((i: any) => i.message).join('; ');
      }
      try {
        return JSON.stringify(body.error);
      } catch {
        return fallback;
      }
    }

    if (typeof body === 'string') return body;

    return fallback;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatFeeLabel(s: FeeStructure): string {
    const month = s.feeMonth ? this.formatMonth(s.feeMonth) : 'One-time';
    return `${s.feeType} — ${month} — ₹${paiseToRupees(s.amount).toLocaleString('en-IN')}`;
  }

  formatAssignmentLabel(a: StudentFeeAssignment): string {
    const month = a.feeMonth ? this.formatMonth(a.feeMonth) : 'One-time';
    return `${a.feeType} — ${month} — ₹${paiseToRupees(a.amount).toLocaleString('en-IN')}`;
  }

  formatMonth(feeMonth: string): string {
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

  formatConcessionValue(c: FeeConcession): string {
    if (c.concessionType === 'PERCENTAGE') return `${c.concessionValue}%`;
    return `₹${paiseToRupees(c.concessionValue).toLocaleString('en-IN')}`;
  }

  paiseToRupees(paise: number): number {
    return paise / 100;
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
