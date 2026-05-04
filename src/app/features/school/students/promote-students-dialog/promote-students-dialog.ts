// promote-students-dialog.ts

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import { ToastService } from '../../../../core/services/toast.service';


type PromoteMode = 'mapping' | 'specific';

export interface PromoteDialogData {
  studentIds: number[];
  studentNames: string[];
  currentClassSectionId: number;
  classSections: ClassSection[];
  currentClassName?: string;
  currentSectionName?: string;
}

export interface PromoteDialogResult {
  success: boolean;
  message?: string;
}

@Component({
  selector: 'app-promote-students-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatStepperModule,
    MatFormFieldModule,
    MatSelectModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './promote-students-dialog.html',
  styleUrl: './promote-students-dialog.scss',
})
export class PromoteStudentsDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<PromoteStudentsDialogComponent>);
  data: PromoteDialogData = inject(MAT_DIALOG_DATA);

  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);

  // ── State ─────────────────────────────────────────────────────────────────
  step = signal<1 | 2 | 3>(1);
  mode = signal<PromoteMode>('mapping');
  selectedTargetId = signal<number | null>(null);
  promoting = signal(false);
  promoteResult = signal<{
    successCount: number;
    failCount: number;
    results: Array<{
      studentId: number;
      studentName: string;
      success: boolean;
      oldClassSection?: string;
      newClassSection?: string;
      error?: string;
    }>;
    message: string;
  } | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  isSingleStudent = computed(() => this.data.studentIds.length === 1);
  studentCount = computed(() => this.data.studentIds.length);

  availableClassSections = computed(() =>
    (this.data.classSections ?? []).filter((cs) => cs.id !== this.data.currentClassSectionId)
  );

  canProceedToStep2 = computed(() => {
    if (this.mode() === 'mapping') return true;
    return this.selectedTargetId() !== null;
  });

  canPromote = computed(() => {
    if (this.step() !== 2) return false;
    if (this.mode() === 'mapping') return true;
    return this.selectedTargetId() !== null;
  });

  selectedTargetName = computed(() => {
    if (!this.selectedTargetId()) return null;
    const cs = this.availableClassSections().find((c) => c.id === this.selectedTargetId());
    return cs ? `${cs.className} — ${cs.sectionName}` : null;
  });

  ngOnInit(): void {}

  goToStep2(): void {
    this.step.set(2);
  }

  goBack(): void {
    if (this.step() === 2) this.step.set(1);
  }

  promote(): void {
    if (!this.canPromote()) return;
    this.promoting.set(true);

    const payload: {
      studentIds: number[];
      targetClassSectionId?: number | null;
      useMapping: boolean;
    } = {
      studentIds: this.data.studentIds,
      useMapping: this.mode() === 'mapping',
    };

    if (this.mode() === 'specific' && this.selectedTargetId()) {
      payload.targetClassSectionId = this.selectedTargetId();
      payload.useMapping = false;
    }

    this.academicsService.bulkPromoteStudents(payload).subscribe({
      next: (res) => {
        this.promoting.set(false);
        this.promoteResult.set(res);
        this.step.set(3);
      },
      error: (err) => {
        this.promoting.set(false);
        this.toast.error(err?.error?.error || 'Promotion failed. Please try again.');
      },
    });
  }

  closeSuccess(): void {
    const result = this.promoteResult();
    this.dialogRef.close({
      success: (result?.successCount ?? 0) > 0,
      message: result?.message,
    } as PromoteDialogResult);
  }

  closeCancel(): void {
    this.dialogRef.close(null);
  }
}
