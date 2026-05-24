// features/school/fees/fee-structures/fee-structure-form/fee-structure-form.ts
import { Component, OnInit, Inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {
  FeesService,
  FeeStructure,
  paiseToRupees,
  rupeesToPaise,
} from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { INDIAN_DATE_PROVIDERS } from '../../../../../core/adapters/indian-date-adapter';

export interface FeeStructureFormData {
  mode: 'create' | 'edit';
  structure?: FeeStructure;
}

const FEE_TYPE_SUGGESTIONS = [
  'TUITION',
  'LIBRARY',
  'ADMISSION',
  'EXAM',
  'SPORTS',
  'DEVELOPMENT',
  'COMPUTER',
  'ANNUAL',
  'LATE_FEE',
];

// Build month options: Jan–Dec labels with value "YYYY-MM"
// We only need the month names; the year is selected separately in the picker.
const MONTH_NAMES = [
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

@Component({
  selector: 'app-fee-structure-form',
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
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-structure-form.html',
  styleUrl: './fee-structure-form.scss',
})
export class FeeStructureFormComponent implements OnInit {
  form!: FormGroup;
  saving = signal(false);
  error = signal<string | null>(null);
  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);
  feeTypeSuggestions = FEE_TYPE_SUGGESTIONS;

  // ── Month picker state ───────────────────────────────────────────────────
  monthPickerOpen = signal(false);
  /** Year displayed in the month picker panel */
  pickerYear = signal(new Date().getFullYear());
  monthNames = MONTH_NAMES;

  /** The currently selected month label for display, e.g. "April 2025" */
  get feeMonthDisplay(): string {
    const raw: string | null = this.form?.get('feeMonth')?.value;
    if (!raw) return '';
    const [year, month] = raw.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  get isEdit(): boolean {
    return this.data.mode === 'edit';
  }

  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    private academics: AcademicsService,
    private datePipe: DatePipe,
    public dialogRef: MatDialogRef<FeeStructureFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeStructureFormData
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadDropdowns();
    if (this.isEdit && this.data.structure) {
      this.patchForm(this.data.structure);
    }
  }

  buildForm(): void {
    this.form = this.fb.group({
      academicYearId: [null, Validators.required],
      classSectionId: [null, Validators.required],
      feeType: ['', [Validators.required, Validators.minLength(2)]],
      amountRupees: [null, [Validators.required, Validators.min(1)]],
      /** Stored as "YYYY-MM" string */
      feeMonth: [null],
      /** Stored as a JS Date (Material datepicker) — serialised to "YYYY-MM-DD" on submit */
      dueDateObj: [null],
      isMandatory: [true],
      description: [''],
    });
  }

  patchForm(s: FeeStructure): void {
    // Parse due date string → Date object for the datepicker
    let dueDateObj: Date | null = null;
    if (s.dueDate) {
      // s.dueDate is "YYYY-MM-DD" from the backend
      const [y, m, d] = s.dueDate.split('-').map(Number);
      dueDateObj = new Date(y, m - 1, d);
    }

    this.form.patchValue({
      academicYearId: s.academicYearId,
      classSectionId: s.classSectionId,
      feeType: s.feeType,
      amountRupees: paiseToRupees(s.amount),
      feeMonth: s.feeMonth,
      dueDateObj,
      isMandatory: s.isMandatory,
      description: s.description ?? '',
    });

    // Initialise picker year to the stored fee month's year (or current year)
    if (s.feeMonth) {
      this.pickerYear.set(parseInt(s.feeMonth.split('-')[0], 10));
    }
  }

  loadDropdowns(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years),
    });
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
  }

  selectFeeType(type: string): void {
    this.form.patchValue({ feeType: type });
  }

  // ── Month picker helpers ─────────────────────────────────────────────────

  toggleMonthPicker(): void {
    this.monthPickerOpen.update((v) => !v);
  }

  closeMonthPicker(): void {
    this.monthPickerOpen.set(false);
  }

  prevYear(): void {
    this.pickerYear.update((y) => y - 1);
  }

  nextYear(): void {
    this.pickerYear.update((y) => y + 1);
  }

  selectMonth(monthIndex: number): void {
    // monthIndex is 0-based (Jan = 0)
    const mm = String(monthIndex + 1).padStart(2, '0');
    const value = `${this.pickerYear()}-${mm}`;
    this.form.patchValue({ feeMonth: value });
    this.monthPickerOpen.set(false);
  }

  clearFeeMonth(event: Event): void {
    event.stopPropagation();
    this.form.patchValue({ feeMonth: null });
  }

  /** Returns true if the given month (0-based) + pickerYear matches the stored value */
  isMonthSelected(monthIndex: number): boolean {
    const raw: string | null = this.form?.get('feeMonth')?.value;
    if (!raw) return false;
    const [year, month] = raw.split('-').map(Number);
    return year === this.pickerYear() && month === monthIndex + 1;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;

    // Serialise Date → "YYYY-MM-DD"
    let dueDate: string | null = null;
    if (v.dueDateObj instanceof Date && !isNaN(v.dueDateObj.getTime())) {
      dueDate = this.datePipe.transform(v.dueDateObj, 'yyyy-MM-dd');
    }

    const payload = {
      academicYearId: v.academicYearId,
      classSectionId: v.classSectionId,
      feeType: v.feeType.trim().toUpperCase(),
      amount: rupeesToPaise(v.amountRupees),
      feeMonth: v.feeMonth || null,
      dueDate,
      isMandatory: v.isMandatory,
      description: v.description?.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    const call$ = this.isEdit
      ? this.fees.updateFeeStructure(this.data.structure!.id, payload)
      : this.fees.createFeeStructure(payload);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to save fee structure');
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
