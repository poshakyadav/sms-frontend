// calendar-action-dialog.ts

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

type DayType = 'WORKING_DAY' | 'HOLIDAY';

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

  private initialDayType: DayType =
    this.data.suggestedDayType ?? this.data.currentStatus?.dayType ?? 'WORKING_DAY';

  // Signal mirror of the dayType control — form.value is a plain snapshot,
  // not a signal, so a computed() reading it directly would never
  // recompute on radio-button changes. This is what the template reacts to.
  dayType = signal<DayType>(this.initialDayType);
  isHolidaySelected = computed(() => this.dayType() === 'HOLIDAY');

  form = this.fb.group({
    dayType: [this.initialDayType, Validators.required],
    scope: ['SECTION' as 'SECTION' | 'SCHOOL', Validators.required],
    reason: ['', [Validators.maxLength(200)]],
  });

  // form = this.fb.group({
  //   dayType: [this.data.suggestedDayType ?? this.data.currentStatus?.dayType ?? 'WORKING_DAY', Validators.required],
  //   scope: ['SECTION' as 'SECTION' | 'SCHOOL', Validators.required],
  //   reason: ['', [Validators.required, Validators.maxLength(200)]],
  // });

  // isHolidaySelected = computed(() => this.form.value.dayType === 'HOLIDAY');

  // constr
  
  constructor() {
    this.updateReasonValidator(this.initialDayType);

    this.form.get('dayType')!.valueChanges.subscribe((value) => {
      const dt = (value ?? 'WORKING_DAY') as DayType;
      this.dayType.set(dt);
      this.updateReasonValidator(dt);
      this.refreshImpactPreview();
    });

    // Scope also affects the impact preview (school-wide vs section), reason text doesn't.
    this.form.get('scope')!.valueChanges.subscribe(() => this.refreshImpactPreview());

    this.refreshImpactPreview();
  }

  private updateReasonValidator(dayType: DayType) {
    const reasonControl = this.form.get('reason')!;
    reasonControl.setValidators(
      dayType === 'HOLIDAY' ? [Validators.required, Validators.maxLength(200)] : [Validators.maxLength(200)]
    );
    reasonControl.updateValueAndValidity({ emitEvent: false });
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
    const trimmedReason = (reason ?? '').trim();

    const payload = {
      fromDate: this.data.date,
      toDate: this.data.date,
      classSectionId,
      // Omit the key entirely when empty — Angular's HttpClient drops
      // `undefined` values on JSON.stringify, so Working Day saves send
      // no reason field at all instead of an empty string that used to
      // fail the old required-reason schema.
      reason: trimmedReason || undefined,
    };

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
        this.toast.error(this.extractErrorMessage(err));
      },
    });
  }

  // Defense in depth: even after standardizing the backend's validation-error
// shape, don't assume every failure path (network errors, a proxy 502,
// a future endpoint someone forgets to update) returns a clean string.
private extractErrorMessage(err: any): string {
  const raw = err?.error?.error ?? err?.error?.message ?? err?.message;
  return typeof raw === 'string' && raw.trim() ? raw : 'Failed to update attendance calendar';
}

  cancel() {
    this.ref.close({ success: false });
  }
}