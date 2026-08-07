// attendance-settings-component.ts

import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AttendanceService } from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-attendance-settings',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './attendance-settings-component.html',
  styleUrl: './attendance-settings-component.scss',
})
export class AttendanceSettingsComponent {
  private attendance = inject(AttendanceService);
  private toast = inject(ToastService);

  readonly dayLabels = DAY_LABELS;
  readonly dayIndices = [0, 1, 2, 3, 4, 5, 6];

  selectedDays = signal<Set<number>>(new Set());
  loading = signal(true);
  saving = signal(false);

  constructor() {
    this.attendance.getWeeklyOffDays()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => this.selectedDays.set(new Set(res.weeklyOffDays)),
        error: () => this.toast.error('Failed to load weekly off settings'),
        complete: () => this.loading.set(false),
      });
  }

  toggle(day: number) {
    this.selectedDays.update((set) => {
      const next = new Set(set);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  isSelected(day: number): boolean {
    return this.selectedDays().has(day);
  }

  save() {
    this.saving.set(true);
    this.attendance.setWeeklyOffDays(Array.from(this.selectedDays())).subscribe({
      next: (res) => { this.selectedDays.set(new Set(res.weeklyOffDays)); this.toast.success('Weekly off days updated'); },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to update weekly off days'),
      complete: () => this.saving.set(false),
    });
  }
}