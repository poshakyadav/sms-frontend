// unenroll-student-dialog.ts
// Path: src/app/features/school/academics/unenroll/unenroll-student-dialog.ts

import {
  Component,
  Inject,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AcademicsService, EnrollmentStatus, UnenrollmentType } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';



export interface UnenrollDialogData {
  studentId: number;
  studentName: string;
  /** Pre-loaded enrollment status — avoids an extra HTTP call if caller already has it */
  enrollmentStatus?: EnrollmentStatus;
}

export interface UnenrollDialogResult {
  success: true;
  message: string;
  studentName: string;
  unenrollmentType: UnenrollmentType;
  userAccountDeactivated: boolean;
}

@Component({
  selector: 'app-unenroll-student-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './unenroll-student-dialog.html',
  styleUrl: './unenroll-student-dialog.scss',
})
export class UnenrollStudentDialog {
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  // ── State ─────────────────────────────────────────────────────────────────
  loading = signal(true);        // loading pre-flight status
  submitting = signal(false);    // during the actual POST
  status = signal<EnrollmentStatus | null>(null);
  error = signal<string | null>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  form: FormGroup;

  // ── Computed helpers ──────────────────────────────────────────────────────
  isPermanent = computed(
    () => this.form?.get('unenrollmentType')?.value === 'PERMANENT'
  );

  hasPendingFees = computed(
    () => (this.status()?.pendingFees?.hasPendingFees ?? false)
  );

  pendingAmount = computed(
    () => this.status()?.pendingFees?.pendingAmount ?? 0
  );

  needsFeeAcknowledgment = computed(
    () => this.hasPendingFees() && !this.form?.get('acknowledgePendingFees')?.value
  );

  constructor(
    public dialogRef: MatDialogRef<UnenrollStudentDialog, UnenrollDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: UnenrollDialogData
  ) {
    this.form = this.fb.group({
      unenrollmentType: ['TEMPORARY', Validators.required],
      reason: [
        '',
        [
          Validators.required,
          Validators.minLength(5),
          Validators.maxLength(500),
        ],
      ],
      acknowledgePendingFees: [false],
    });

    // If status was pre-loaded by caller, use it
    if (data.enrollmentStatus) {
      this.status.set(data.enrollmentStatus);
      this.loading.set(false);
    } else {
      this.loadStatus();
    }
  }

  loadStatus(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academics.getEnrollmentStatus(this.data.studentId).subscribe({
      next: (res) => {
        this.status.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || err?.message || 'Failed to load enrollment details');
        this.loading.set(false);
      },
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  close(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.status()?.isEnrolled) {
      this.toast.error('Student is not currently enrolled');
      return;
    }

    this.submitting.set(true);

    const payload = {
      studentId: this.data.studentId,
      unenrollmentType: this.form.value.unenrollmentType as UnenrollmentType,
      reason: this.form.value.reason.trim(),
      acknowledgePendingFees: this.form.value.acknowledgePendingFees ?? false,
    };

    this.academics.unenrollStudent(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.dialogRef.close({
          success: true,
          message: res.message,
          studentName: res.audit.studentName,
          unenrollmentType: res.audit.unenrollmentType,
          userAccountDeactivated: res.audit.userAccountDeactivated,
        });
      },
      error: (err) => {
        this.submitting.set(false);
        const errorBody = err?.error;

        // 409 = pending fees need acknowledgment
        if (err?.status === 409 && errorBody?.requiresAcknowledgment) {
          this.form.get('acknowledgePendingFees')?.setValue(false);
          this.toast.error(
            'Please acknowledge the pending fees before proceeding'
          );
          return;
        }

        this.toast.error(
          errorBody?.error || err?.message || 'Unenrollment failed'
        );
      },
    });
  }

  get reasonControl() {
    return this.form.get('reason');
  }

  get typeControl() {
    return this.form.get('unenrollmentType');
  }
}