// assign-roll-numbers-dialog.ts

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AcademicsService } from '../../../../core/services/academics.service';
import { ToastService } from '../../../../core/services/toast.service';

export interface AssignRollNumbersDialogData {
  classSectionId: number;
  className: string;
  sectionName: string;
  studentCount: number;
  hasExistingRollNumbers: boolean;
}

type OrderBy = 'name' | 'admissionDate';

@Component({
  selector: 'app-assign-roll-numbers-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './assign-roll-numbers-dialog.html',
  styleUrl: './assign-roll-numbers-dialog.scss',
})
export class AssignRollNumbersDialog {
  private dialogRef = inject(MatDialogRef<AssignRollNumbersDialog>);
  data = inject<AssignRollNumbersDialogData>(MAT_DIALOG_DATA);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);

  // ── State ─────────────────────────────────────────────────────────────────
  orderBy = signal<OrderBy>('name');
  loading = signal(false);
  success = signal(false);
  result = signal<{ count: number; orderBy: string } | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  selectedLabel = computed(() =>
    this.orderBy() === 'name' ? 'Alphabetical (A → Z)' : 'Admission Date (Oldest → Newest)'
  );

  exampleRolls = computed(() => {
    if (this.orderBy() === 'name') {
      return [
        { name: 'Aarav Sharma', roll: '001' },
        { name: 'Priya Singh', roll: '002' },
        { name: 'Rohan Verma', roll: '003' },
      ];
    }
    return [
      { name: 'Oldest Admitted', roll: '001' },
      { name: 'Second Admitted', roll: '002' },
      { name: 'Newest Admitted', roll: '003' },
    ];
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  setOrderBy(value: OrderBy): void {
    this.orderBy.set(value);
  }

  assign(): void {
    if (this.loading()) return;

    this.loading.set(true);

    this.academicsService
      .assignRollNumbers({
        classSectionId: this.data.classSectionId,
        orderBy: this.orderBy(),
      })
      .subscribe({
        next: (res: any) => {
          this.loading.set(false);
          this.success.set(true);
          this.result.set({
            count: res.count ?? this.data.studentCount,
            orderBy: this.orderBy(),
          });
          this.toast.success(
            res.message ?? `Roll numbers assigned to ${this.data.studentCount} students`
          );
        },
        error: (err: any) => {
          this.loading.set(false);
          this.toast.error(err?.error?.error ?? 'Failed to assign roll numbers. Please try again.');
        },
      });
  }

  close(): void {
    this.dialogRef.close(this.success() ? { success: true } : null);
  }
}
