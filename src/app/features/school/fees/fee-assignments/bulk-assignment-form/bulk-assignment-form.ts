// features/school/fees/fee-assignments/bulk-assignment-form/bulk-assignment-form.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, rupeesToPaise } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkAssignmentFormData {
  enrollmentId: number;
  studentName?: string;
  academicYearId?: number;
}

export interface MonthOption {
  value: number; // 1–12
  label: string; // 'January'
  short: string; // 'Jan'
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const MONTHS: MonthOption[] = [
  { value: 1, label: 'January', short: 'Jan' },
  { value: 2, label: 'February', short: 'Feb' },
  { value: 3, label: 'March', short: 'Mar' },
  { value: 4, label: 'April', short: 'Apr' },
  { value: 5, label: 'May', short: 'May' },
  { value: 6, label: 'June', short: 'Jun' },
  { value: 7, label: 'July', short: 'Jul' },
  { value: 8, label: 'August', short: 'Aug' },
  { value: 9, label: 'September', short: 'Sep' },
  { value: 10, label: 'October', short: 'Oct' },
  { value: 11, label: 'November', short: 'Nov' },
  { value: 12, label: 'December', short: 'Dec' },
];

const FEE_TYPE_SUGGESTIONS = [
  'MONTHLY',
  'TRANSPORT',
  'HOSTEL',
  'SPORTS',
  'SPECIAL_COACHING',
  'LIBRARY_FINE',
  'UNIFORM',
];

// ─────────────────────────────────────────────────────────────────────────────
// FORM-LEVEL VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cross-field validator: end month must be on or after start month.
 * Runs on the FormGroup so both fields are always in scope.
 */
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const startYear = group.get('startYear')?.value as number | null;
  const startMonth = group.get('startMonth')?.value as number | null;
  const endYear = group.get('endYear')?.value as number | null;
  const endMonth = group.get('endMonth')?.value as number | null;

  // Only validate once all four values are present
  if (!startYear || !startMonth || !endYear || !endMonth) return null;

  const start = startYear * 12 + startMonth;
  const end = endYear * 12 + endMonth;

  return end >= start ? null : { endBeforeStart: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert year + month number → "YYYY-MM" API string. */
function toYYYYMM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Build the human-readable list of months that will receive an assignment.
 * Returns [] when the range is empty or invalid.
 */
function buildMonthRange(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): string[] {
  const result: string[] = [];
  let y = startYear;
  let m = startMonth;

  while (y < endYear || (y === endYear && m <= endMonth)) {
    result.push(`${MONTHS[m - 1].short} ${y}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (result.length > 36) break; // hard safety cap
  }
  return result;
}

/** Build a reasonable set of selectable years centred on the current year. */
function buildYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 1; y <= current + 3; y++) years.push(y);
  return years;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bulk-assignment-form',
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
  templateUrl: './bulk-assignment-form.html',
  styleUrl: './bulk-assignment-form.scss',
})
export class BulkAssignmentFormComponent implements OnInit, OnDestroy {
  // ── Form ──────────────────────────────────────────────────────────────────
  form!: FormGroup;

  // ── UI state signals (safe to read from OnPush template) ──────────────────
  saving = signal(false);
  error = signal<string | null>(null);
  academicYears = signal<any[]>([]);

  /**
   * The derived month list displayed in the preview strip AND used to
   * enable / disable the submit button.
   *
   * WHY a plain signal instead of computed():
   *   computed() only re-evaluates when *Angular signals* it depends on
   *   change.  FormGroup.value is NOT a signal — it is a plain object that
   *   mutates.  Wrapping it in computed() therefore never re-runs after the
   *   initial evaluation.
   *
   *   The correct bridge is: subscribe to form.valueChanges (an RxJS
   *   Observable), recalculate, and push the new value into a writable
   *   signal.  ChangeDetectionStrategy.OnPush will then pick up the
   *   signal write and schedule a re-render automatically.
   */
  monthPreview = signal<string[]>([]);

  /**
   * True when the cross-field date-range validator fires AND the end
   * fields have been touched (so we don't show the error on first open).
   * Updated in the same valueChanges subscription as monthPreview.
   */
  hasRangeError = signal(false);

  // ── Static lookup tables (bound directly in the template) ─────────────────
  readonly months = MONTHS;
  readonly years = buildYearOptions();
  readonly feeTypeSuggestions = FEE_TYPE_SUGGESTIONS;

  // ── Teardown ──────────────────────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ─────────────────────────────────────────────────────────────────────────
  constructor(
    private readonly fb: FormBuilder,
    private readonly fees: FeesService,
    private readonly academics: AcademicsService,
    public readonly dialogRef: MatDialogRef<BulkAssignmentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: BulkAssignmentFormData
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForm();
    this.subscribeToFormChanges(); // must come after buildForm()
    this.loadDropdowns();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Form construction ─────────────────────────────────────────────────────

  private buildForm(): void {
    const currentYear = new Date().getFullYear();

    this.form = this.fb.group(
      {
        academicYearId: [this.data.academicYearId ?? null, Validators.required],
        feeType: ['TRANSPORT', [Validators.required, Validators.minLength(2)]],
        amountRupees: [null, [Validators.required, Validators.min(1)]],

        // Date range — four separate fields instead of <input type="month">
        startMonth: [null, Validators.required],
        startYear: [currentYear, Validators.required],
        endMonth: [null, Validators.required],
        endYear: [currentYear, Validators.required],

        // Optional
        dueDayOfMonth: [null, [Validators.min(1), Validators.max(28)]],
        description: [''],
      },
      { validators: dateRangeValidator }
    );
  }

  /**
   * Bridge between the RxJS world (FormGroup.valueChanges) and the
   * Angular Signals world (monthPreview, hasRangeError).
   *
   * Every time ANY control changes:
   *   1. Recalculate the month list and write it to monthPreview signal.
   *   2. Re-check the cross-field validator result and write to hasRangeError.
   *
   * Writing to a signal inside OnPush is the idiomatic, zone-free way to
   * schedule a re-render without calling ChangeDetectorRef.markForCheck()
   * manually.
   */
  private subscribeToFormChanges(): void {
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      // ── Preview list ──────────────────────────────────────────────────
      if (v.startYear && v.startMonth && v.endYear && v.endMonth) {
        this.monthPreview.set(buildMonthRange(v.startYear, v.startMonth, v.endYear, v.endMonth));
      } else {
        this.monthPreview.set([]);
      }

      // ── Cross-field error ─────────────────────────────────────────────
      const endYearTouched = this.form.get('endYear')?.touched ?? false;
      const endMonthTouched = this.form.get('endMonth')?.touched ?? false;

      this.hasRangeError.set(
        !!(this.form.errors?.['endBeforeStart'] && endYearTouched && endMonthTouched)
      );
    });
  }

  // ── Remote data ───────────────────────────────────────────────────────────

  loadDropdowns(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years);
        if (!this.data.academicYearId) {
          const current = res.years.find((y: any) => y.isCurrent);
          if (current) this.form.patchValue({ academicYearId: current.id });
        }
      },
    });
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  selectFeeType(type: string): void {
    this.form.patchValue({ feeType: type });
    this.form.get('feeType')?.markAsTouched();
  }

  // Expose as getters so the template can iterate them cleanly.
  // Both return the full MONTHS array; filtering by year is straightforward
  // to add here in the future without touching the template.
  get startMonthOptions(): MonthOption[] {
    return MONTHS;
  }
  get endMonthOptions(): MonthOption[] {
    return MONTHS;
  }

  // ── Submission ────────────────────────────────────────────────────────────

  submit(): void {
    this.form.markAllAsTouched();

    // Re-evaluate cross-field error visibility after touching all fields
    this.hasRangeError.set(!!this.form.errors?.['endBeforeStart']);

    if (this.form.invalid) return;

    const preview = this.monthPreview();
    if (preview.length === 0) {
      this.error.set('End month must be on or after the start month.');
      return;
    }

    const v = this.form.getRawValue();

    const payload = {
      enrollmentId: this.data.enrollmentId,
      academicYearId: v.academicYearId as number,
      feeType: (v.feeType as string).trim().toUpperCase(),
      amount: rupeesToPaise(v.amountRupees as number),
      startMonth: toYYYYMM(v.startYear as number, v.startMonth as number),
      endMonth: toYYYYMM(v.endYear as number, v.endMonth as number),
      dueDayOfMonth: (v.dueDayOfMonth as number | null) || undefined,
      description: (v.description as string)?.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    this.fees.createBulkMonthlyAssignments(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res.monthCount);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to create bulk assignments.');
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
