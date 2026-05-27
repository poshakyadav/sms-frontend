// features/school/fees/fee-structures/bulk-monthly-structure-form/bulk-monthly-structure-form.ts
import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
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
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, rupeesToPaise } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = [
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

const MONTH_NAMES_FULL = [
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

const FEE_TYPE_SUGGESTIONS = ['MONTHLY','TUITION', 'LIBRARY', 'EXAM', 'SPORTS', 'DEVELOPMENT', 'COMPUTER'];

/** Build a range of years centred around the current year. */
function buildYearOptions(spread = 3): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 1; y <= current + spread; y++) {
    years.push(y);
  }
  return years;
}

/** Custom validator: endMonth must be ≥ startMonth */
function monthRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startMonth')?.value as string;
  const end = group.get('endMonth')?.value as string;
  if (!start || !end) return null;
  return start <= end ? null : { monthRangeInvalid: true };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bulk-monthly-structure-form',
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
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-monthly-structure-form.html',
  styleUrl: './bulk-monthly-structure-form.scss',
})
export class BulkMonthlyStructureFormComponent implements OnInit {
  // ── Form ────────────────────────────────────────────────────────────────────
  form!: FormGroup;

  // ── State ───────────────────────────────────────────────────────────────────
  saving = signal(false);
  error = signal<string | null>(null);
  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);

  // ── Static options ──────────────────────────────────────────────────────────
  readonly feeTypeSuggestions = FEE_TYPE_SUGGESTIONS;
  readonly monthOptions = MONTH_NAMES_FULL.map((name, i) => ({
    value: i + 1, // 1-based
    label: name,
    short: MONTH_NAMES_SHORT[i],
  }));
  readonly yearOptions = buildYearOptions();

  // ── Derived: composed YYYY-MM strings ──────────────────────────────────────
  readonly startMonthValue = computed<string>(() => {
    const sm = this.form?.get('startMonthNum')?.value as number | null;
    const sy = this.form?.get('startYear')?.value as number | null;
    if (!sm || !sy) return '';
    return `${sy}-${String(sm).padStart(2, '0')}`;
  });

  readonly endMonthValue = computed<string>(() => {
    const em = this.form?.get('endMonthNum')?.value as number | null;
    const ey = this.form?.get('endYear')?.value as number | null;
    if (!em || !ey) return '';
    return `${ey}-${String(em).padStart(2, '0')}`;
  });

  readonly monthPreview = computed<string[]>(() => {
    const start = this.startMonthValue();
    const end = this.endMonthValue();
    if (!start || !end || start > end) return [];
    return this.generateMonthRange(start, end);
  });

  readonly rangeError = computed<boolean>(() => {
    const start = this.startMonthValue();
    const end = this.endMonthValue();
    return !!(start && end && start > end);
  });

  // ── DI ──────────────────────────────────────────────────────────────────────
  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    private academics: AcademicsService,
    public dialogRef: MatDialogRef<BulkMonthlyStructureFormComponent>
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForm();
    this.loadDropdowns();
  }

  // ── Form construction ───────────────────────────────────────────────────────
  buildForm(): void {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-based

    this.form = this.fb.group({
      academicYearId: [null, Validators.required],
      classSectionId: [null, Validators.required],
      feeType: ['TUITION', [Validators.required, Validators.minLength(2)]],
      amountRupees: [null, [Validators.required, Validators.min(1)]],

      // Month-picker fields — four separate controls
      startMonthNum: [currentMonth, Validators.required],
      startYear: [currentYear, Validators.required],
      endMonthNum: [currentMonth, Validators.required],
      endYear: [currentYear, Validators.required],

      dueDayOfMonth: [null, [Validators.min(1), Validators.max(28)]],
      description: [''],
      isMandatory: [true],
    });
  }

  // ── Dropdown data ───────────────────────────────────────────────────────────
  loadDropdowns(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years),
    });
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
  }

  // ── Fee-type chip ────────────────────────────────────────────────────────────
  selectFeeType(type: string): void {
    this.form.patchValue({ feeType: type });
  }

  // ── Month range logic ────────────────────────────────────────────────────────
  generateMonthRange(start: string, end: string): string[] {
    const months: string[] = [];
    if (!start || !end) return months;
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    let y = sy,
      m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${MONTH_NAMES_SHORT[m - 1]} ${y}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      if (months.length > 36) break;
    }
    return months;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const start = this.startMonthValue();
    const end = this.endMonthValue();
    const months = this.monthPreview();

    if (!start || !end) {
      this.error.set('Please select both start and end months.');
      return;
    }
    if (start > end) {
      this.error.set('End month must be on or after the start month.');
      return;
    }
    if (months.length === 0) {
      this.error.set('No months in the selected range.');
      return;
    }

    const v = this.form.value;
    const payload = {
      academicYearId: v.academicYearId,
      classSectionId: v.classSectionId,
      feeType: (v.feeType as string).trim().toUpperCase(),
      amount: rupeesToPaise(v.amountRupees),
      startMonth: start,
      endMonth: end,
      dueDayOfMonth: v.dueDayOfMonth || undefined,
      description: v.description?.trim() || null,
      isMandatory: v.isMandatory,
    };

    this.saving.set(true);
    this.error.set(null);

    this.fees.createBulkMonthlyStructures(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res.monthCount);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to create bulk structures.');
        this.saving.set(false);
      },
    });
  }

  // ── Close ────────────────────────────────────────────────────────────────────
  close(): void {
    this.dialogRef.close(false);
  }

  // ── Helpers for template ─────────────────────────────────────────────────────
  hasError(control: string, error: string): boolean {
    const c = this.form.get(control);
    return !!(c?.hasError(error) && c.touched);
  }

  isRequired(control: string): boolean {
    const c = this.form.get(control);
    return !!(c?.invalid && c.touched);
  }
}
