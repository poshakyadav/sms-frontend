// features/school/fees/fee-assignments/assignment-form/assignment-form.ts
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
import { INDIAN_DATE_PROVIDERS } from '../../../../../core/adapters/indian-date-adapter';
import { FeesService, rupeesToPaise } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';

export interface AssignmentFormData {
  enrollmentId: number;
  studentName?: string;
  academicYearId?: number;
}

const FEE_TYPE_SUGGESTIONS = [
  'TRANSPORT',
  'HOSTEL',
  'SPORTS',
  'LATE_FEE',
  'SPECIAL_COACHING',
  'LIBRARY_FINE',
  'UNIFORM',
];

export const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

@Component({
  selector: 'app-assignment-form',
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
  templateUrl: './assignment-form.html',
  styleUrl: './assignment-form.scss',
})
export class AssignmentFormComponent implements OnInit {
  form!: FormGroup;
  saving = signal(false);
  error = signal<string | null>(null);
  academicYears = signal<any[]>([]);
  feeTypeSuggestions = FEE_TYPE_SUGGESTIONS;
  monthOptions = MONTH_OPTIONS;

  /** Populate year options: current year − 1 to current + 2 */
  readonly yearOptions: { value: string; label: string }[] = (() => {
    const current = new Date().getFullYear();
    return [-1, 0, 1, 2].map((offset) => {
      const y = (current + offset).toString();
      return { value: y, label: y };
    });
  })();

  /** Min date for the due-date picker: today */
  readonly minDueDate = new Date();

  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    private academics: AcademicsService,
    private datePipe: DatePipe,
    public dialogRef: MatDialogRef<AssignmentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AssignmentFormData
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadDropdowns();
  }

  buildForm(): void {
    this.form = this.fb.group({
      academicYearId: [this.data.academicYearId ?? null, Validators.required],
      feeType: ['TRANSPORT', [Validators.required, Validators.minLength(2)]],
      amountRupees: [null, [Validators.required, Validators.min(1)]],
      // Separate month & year selects — composed into feeMonth on submit
      feeMonthMonth: [null],
      feeMonthYear: [null],
      // MatDatepicker stores a JS Date object internally
      dueDate: [null],
      description: [''],
      isMandatory: [true],
    });
  }

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

  selectFeeType(type: string): void {
    this.form.patchValue({ feeType: type });
  }

  /** Returns true if only one of month/year is selected (mismatched pair). */
  get feeMonthPartialError(): boolean {
    const m = this.form.get('feeMonthMonth')?.value;
    const y = this.form.get('feeMonthYear')?.value;
    return (!!m && !y) || (!m && !!y);
  }

  /** Compose the YYYY-MM string from the two selects, or null if blank. */
  private composeFeeMonth(): string | null {
    const m = this.form.get('feeMonthMonth')?.value;
    const y = this.form.get('feeMonthYear')?.value;
    if (m && y) return `${y}-${m}`;
    return null;
  }

  /**
   * Format the MatDatepicker Date value → "yyyy-MM-dd" for the backend.
   * The IndianDateAdapter holds a native JS Date; DatePipe converts it.
   */
  private formatDueDate(date: Date | null): string | null {
    if (!date) return null;
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? null;
  }

  submit(): void {
    if (this.form.invalid || this.feeMonthPartialError) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const payload = {
      enrollmentId: this.data.enrollmentId,
      academicYearId: v.academicYearId,
      feeType: v.feeType.trim().toUpperCase(),
      amount: rupeesToPaise(v.amountRupees),
      feeMonth: this.composeFeeMonth(),
      // dueDate is now a JS Date from the datepicker — format to yyyy-MM-dd
      dueDate: this.formatDueDate(v.dueDate),
      description: v.description?.trim() || null,
      isMandatory: v.isMandatory,
    };

    this.saving.set(true);
    this.error.set(null);

    this.fees.createStudentFeeAssignment(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to create assignment');
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
