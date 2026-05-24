// features/school/fees/fee-assignments/bulk-assignment-form/bulk-assignment-form.ts
import {
  Component,
  OnInit,
  Inject,
  signal,
  computed,
  ChangeDetectionStrategy,
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
import { FeesService, rupeesToPaise } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';

export interface BulkAssignmentFormData {
  enrollmentId: number;
  studentName?: string;
  academicYearId?: number;
}

const MONTH_NAMES = [
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

const FEE_TYPE_SUGGESTIONS = [
  'TRANSPORT',
  'HOSTEL',
  'SPORTS',
  'SPECIAL_COACHING',
  'LIBRARY_FINE',
  'UNIFORM',
];

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-assignment-form.html',
  styleUrl: './bulk-assignment-form.scss',
})
export class BulkAssignmentFormComponent implements OnInit {
  form!: FormGroup;
  saving = signal(false);
  error = signal<string | null>(null);
  academicYears = signal<any[]>([]);
  feeTypeSuggestions = FEE_TYPE_SUGGESTIONS;

  monthPreview = computed<string[]>(() => {
    const v = this.form?.value;
    if (!v?.startMonth || !v?.endMonth) return [];
    return this.generateMonthRange(v.startMonth, v.endMonth);
  });

  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    private academics: AcademicsService,
    public dialogRef: MatDialogRef<BulkAssignmentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BulkAssignmentFormData
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
      startMonth: ['', Validators.required],
      endMonth: ['', Validators.required],
      dueDayOfMonth: [null, [Validators.min(1), Validators.max(28)]],
      description: [''],
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

  generateMonthRange(start: string, end: string): string[] {
    const months: string[] = [];
    if (!start || !end) return months;
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    let y = sy,
      m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${MONTH_NAMES[m - 1]} ${y}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      if (months.length > 36) break;
    }
    return months;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const months = this.monthPreview();
    if (months.length === 0) {
      this.error.set('End month must be after start month');
      return;
    }

    const v = this.form.value;
    const payload = {
      enrollmentId: this.data.enrollmentId,
      academicYearId: v.academicYearId,
      feeType: v.feeType.trim().toUpperCase(),
      amount: rupeesToPaise(v.amountRupees),
      startMonth: v.startMonth,
      endMonth: v.endMonth,
      dueDayOfMonth: v.dueDayOfMonth || undefined,
      description: v.description?.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    this.fees.createBulkMonthlyAssignments(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res.monthCount);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to create bulk assignments');
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
