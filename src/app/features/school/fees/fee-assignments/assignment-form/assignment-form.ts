// features/school/fees/fee-assignments/assignment-form/assignment-form.ts
import { Component, OnInit, Inject, signal, ChangeDetectionStrategy } from '@angular/core';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
  ],
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

  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    private academics: AcademicsService,
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
      feeMonth: [null],
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
          const current = res.years.find((y) => y.isCurrent);
          if (current) this.form.patchValue({ academicYearId: current.id });
        }
      },
    });
  }

  selectFeeType(type: string): void {
    this.form.patchValue({ feeType: type });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const payload = {
      enrollmentId: this.data.enrollmentId,
      academicYearId: v.academicYearId,
      feeType: v.feeType.trim().toUpperCase(),
      amount: rupeesToPaise(v.amountRupees),
      feeMonth: v.feeMonth || null,
      dueDate: v.dueDate || null,
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
