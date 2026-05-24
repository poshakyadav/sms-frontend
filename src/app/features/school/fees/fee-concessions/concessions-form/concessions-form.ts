// features/school/fees/fee-concessions/concessions-form/concessions-form.ts
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
import {
  FeesService,
  FeeStructure,
  StudentFeeAssignment,
  CreateConcessionPayload,
  paiseToRupees,
} from '../../../../../core/services/fees.service';

export interface ConcessionsFormData {
  enrollmentId: number;
  studentName?: string;
  /** Pre-select STRUCTURE or ASSIGNMENT mode */
  mode?: 'STRUCTURE' | 'ASSIGNMENT';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concessions-form.html',
  styleUrl: './concessions-form.scss',
})
export class ConcessionsFormComponent implements OnInit {
  form!: FormGroup;
  saving = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  sourceMode = signal<'STRUCTURE' | 'ASSIGNMENT'>('STRUCTURE');

  structures = signal<FeeStructure[]>([]);
  assignments = signal<StudentFeeAssignment[]>([]);

  selectedBaseAmount = signal<number>(0);

  previewDiscount = computed(() => {
    const type = this.form?.get('concessionType')?.value;
    const value = this.form?.get('concessionValue')?.value;
    const base = this.selectedBaseAmount();
    if (!base || !value || value <= 0) return null;
    let discount = 0;
    if (type === 'PERCENTAGE') {
      // Mirror the backend: Math.floor to avoid fractional paise
      discount = Math.floor((base * value) / 100);
    } else {
      // value is entered in rupees by the user, base is in paise
      discount = Math.round(value * 100);
    }
    const effective = Math.max(0, base - discount);
    return { discount, effective, base };
  });

  constructor(
    private fb: FormBuilder,
    private fees: FeesService,
    public dialogRef: MatDialogRef<ConcessionsFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConcessionsFormData
  ) {}

  ngOnInit(): void {
    if (this.data.mode) this.sourceMode.set(this.data.mode);
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

    // Update base amount when fee structure selection changes
    this.form.get('feeStructureId')?.valueChanges.subscribe((id) => {
      if (id) {
        const s = this.structures().find((x) => x.id === id);
        this.selectedBaseAmount.set(s?.amount ?? 0);
      } else {
        this.selectedBaseAmount.set(0);
      }
    });

    // Update base amount when assignment selection changes
    this.form.get('studentFeeAssignmentId')?.valueChanges.subscribe((id) => {
      if (id) {
        const a = this.assignments().find((x) => x.id === id);
        // Use effectiveAmount if concessions already applied, otherwise raw amount
        this.selectedBaseAmount.set(a?.amount ?? 0);
      } else {
        this.selectedBaseAmount.set(0);
      }
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    if (this.sourceMode() === 'STRUCTURE') {
      // Load all fee structures so the admin can pick one to apply a concession to.
      // We load all structures (not filtered by enrollment) so the admin can see
      // the class-section level structures. In practice the concession form is
      // opened from the fee report which already knows the student's class-section.
      this.fees.getFeeStructures().subscribe({
        next: (list) => {
          this.structures.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load fee structures');
          this.loading.set(false);
        },
      });
    } else {
      // Load ACTIVE-only assignments for this enrollment.
      // includeAll = false → only non-cancelled assignments are returned.
      // Previously this passed `false` as the second arg which maps to
      // includeAll=false in the service (active only) — but the service
      // signature is getStudentFeeAssignments(enrollmentId, includeAll=false).
      // We explicitly pass false to be clear about intent.
      this.fees.getStudentFeeAssignments(this.data.enrollmentId, false).subscribe({
        next: (list) => {
          this.assignments.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load fee assignments');
          this.loading.set(false);
        },
      });
    }
  }

  setMode(mode: 'STRUCTURE' | 'ASSIGNMENT'): void {
    this.sourceMode.set(mode);
    // Reset both selection fields and base amount when switching mode
    this.form.patchValue({
      feeStructureId: null,
      studentFeeAssignmentId: null,
      concessionValue: null,
    });
    this.selectedBaseAmount.set(0);
    this.loadData();
  }

  setConcessionType(type: 'PERCENTAGE' | 'FIXED'): void {
    this.form.patchValue({ concessionType: type, concessionValue: null });
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

    // Build a discriminated-union payload matching CreateConcessionPayload.
    // Exactly one of feeStructureId / studentFeeAssignmentId is included.
    // The backend Zod schema requires exactly one — not both, not neither.
    const payload: CreateConcessionPayload = isStructure
      ? {
          enrollmentId: this.data.enrollmentId,
          feeStructureId: v.feeStructureId,
          concessionType: v.concessionType,
          // PERCENTAGE: send as-is (1–100). FIXED: convert rupees → paise.
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
        this.error.set(err?.error?.error ?? 'Failed to grant concession');
        this.saving.set(false);
      },
    });
  }

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

  paiseToRupees(paise: number): number {
    return paise / 100;
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
