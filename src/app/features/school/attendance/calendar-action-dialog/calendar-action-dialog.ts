import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AttendanceService,
  CalendarCheckResult,
  HolidayImpactPreview,
} from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';

export interface CalendarActionDialogData {
  date: string;
  classSectionId: number;
  classSectionLabel: string;
  currentStatus: CalendarCheckResult | null;
  suggestedDayType?: 'WORKING_DAY' | 'HOLIDAY';
}

export interface CalendarActionDialogResult {
  success: boolean;
}

@Component({
  selector: 'app-calendar-action-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatRadioModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './calendar-action-dialog.html',
  styleUrl: './calendar-action-dialog.scss',
})
export class CalendarActionDialog {
  private fb = inject(FormBuilder);
  private attendance = inject(AttendanceService);
  private toast = inject(ToastService);
  data = inject<CalendarActionDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<CalendarActionDialog, CalendarActionDialogResult>);

  submitting = signal(false);
  impactPreview = signal<HolidayImpactPreview | null>(null);
  checkingImpact = signal(false);
  riskAcknowledged = signal(false);

  form = this.fb.group({
    dayType: [this.data.suggestedDayType ?? this.data.currentStatus?.dayType ?? 'WORKING_DAY', Validators.required],
    scope: ['SECTION' as 'SECTION' | 'SCHOOL', Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(200)]],
  });

  isHolidaySelected = computed(() => this.form.value.dayType === 'HOLIDAY');

  constructor() {
    this.form.valueChanges.subscribe(() => this.refreshImpactPreview());
    this.refreshImpactPreview();
  }

  private refreshImpactPreview() {
    if (this.form.value.dayType !== 'HOLIDAY') {
      this.impactPreview.set(null);
      this.riskAcknowledged.set(false);
      return;
    }
    this.checkingImpact.set(true);
    const classSectionId = this.form.value.scope === 'SECTION' ? this.data.classSectionId : undefined;
    this.attendance.previewHolidayImpact(this.data.date, this.data.date, classSectionId).subscribe({
      next: (preview) => {
        this.impactPreview.set(preview);
        this.checkingImpact.set(false);
        if (preview.count === 0) this.riskAcknowledged.set(true);
        else this.riskAcknowledged.set(false);
      },
      error: () => this.checkingImpact.set(false),
    });
  }

  get requiresRiskAck(): boolean {
    return this.isHolidaySelected() && (this.impactPreview()?.count ?? 0) > 0;
  }

  canSubmit(): boolean {
    if (!this.form.valid) return false;
    if (this.checkingImpact()) return false;
    if (this.requiresRiskAck && !this.riskAcknowledged()) return false;
    return true;
  }

  onAckChange(checked: boolean) {
    this.riskAcknowledged.set(checked);
  }

  submit() {
    if (!this.canSubmit()) return;
    const { dayType, scope, reason } = this.form.value;
    const classSectionId = scope === 'SECTION' ? this.data.classSectionId : undefined;
    const payload = { fromDate: this.data.date, toDate: this.data.date, classSectionId, reason: reason!.trim() };

    this.submitting.set(true);
    const req$ = dayType === 'HOLIDAY' ? this.attendance.declareHoliday(payload) : this.attendance.setWorkingDayOverride(payload);

    req$.subscribe({
      next: () => {
        this.toast.success(dayType === 'HOLIDAY' ? 'Marked as holiday' : 'Marked as working day');
        this.submitting.set(false);
        this.ref.close({ success: true });
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(err?.error?.error || 'Failed to update attendance calendar');
      },
    });
  }

  cancel() {
    this.ref.close({ success: false });
  }
}