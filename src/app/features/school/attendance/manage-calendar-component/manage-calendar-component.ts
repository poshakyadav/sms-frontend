// manage-calendar-component.ts

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import {
  AttendanceService,
  CalendarEntry,
  HolidayImpactPreview,
} from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import {
  HolidayImpactConfirmDialog,
  HolidayImpactConfirmDialogData,
} from '../holiday-impact-confirm-dialog/holiday-impact-confirm-dialog';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { INDIAN_DATE_PROVIDERS } from '../../../../core/adapters/indian-date-adapter';

@Component({
  selector: 'app-manage-calendar',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule, MatSelectModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
  templateUrl: './manage-calendar-component.html',
  styleUrl: './manage-calendar-component.scss',
})
export class ManageCalendarComponent {
  private attendance = inject(AttendanceService);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  classSections = signal<ClassSection[]>([]);
  submitting = signal(false);

  declareForm = this.fb.group({
    dayType: ['HOLIDAY' as 'HOLIDAY' | 'WORKING_DAY', Validators.required],
    fromDate: [new Date(), Validators.required],
    toDate: [new Date(), Validators.required],
    scope: ['SCHOOL' as 'SCHOOL' | 'SECTION', Validators.required],
    classSectionId: [null as number | null],
    reason: ['', [Validators.required, Validators.maxLength(200)]],
  });

  // NEW: makes declareForm's live value observable to signals/computed()
  private declareFormValue = toSignal(this.declareForm.valueChanges, {
    initialValue: this.declareForm.value,
  });

  entries = signal<CalendarEntry[]>([]);
  loadingEntries = signal(false);

  filterForm = this.fb.group({
    fromDate: [this.firstOfMonth()],
    toDate: [this.lastOfMonth()],
    classSectionId: [null as number | null],
  });

  dayCount = computed(() => {
    const { fromDate, toDate } = this.declareFormValue();   // now reactive
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to < from) return 0;
    return Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  });

  constructor() {
    this.academics.getClassSections()
      .pipe(takeUntilDestroyed())
      .subscribe((res) => this.classSections.set(res.classSections));

    this.loadEntries();

    this.filterForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadEntries());

    this.declareForm.get('scope')!.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((scope) => {
        if (scope === 'SCHOOL') this.declareForm.patchValue({ classSectionId: null });
      });
  }

  private firstOfMonth(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }
  private lastOfMonth(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

  loadEntries() {
    const { fromDate, toDate, classSectionId } = this.filterForm.value;
    if (!fromDate || !toDate) return;
    const from = this.datePipe.transform(fromDate, 'yyyy-MM-dd')!;
    const to = this.datePipe.transform(toDate, 'yyyy-MM-dd')!;
    this.loadingEntries.set(true);
    this.attendance.getCalendarEntries(from, to, classSectionId ?? undefined).subscribe({
      next: (res) => this.entries.set(res.entries),
      error: (err) => this.toast.error(err?.error?.error || 'Failed to load calendar entries'),
      complete: () => this.loadingEntries.set(false),
    });
  }

  submitDeclare() {
    if (!this.declareForm.valid) {
      this.toast.warning('Please fill all required fields');
      return;
    }
    const { dayType, fromDate, toDate, scope, classSectionId, reason } = this.declareForm.value;
    if (scope === 'SECTION' && !classSectionId) {
      this.toast.warning('Please select a class-section');
      return;
    }
    const from = this.datePipe.transform(fromDate, 'yyyy-MM-dd')!;
    const to = this.datePipe.transform(toDate, 'yyyy-MM-dd')!;
    const csId = scope === 'SECTION' ? classSectionId! : undefined;

    if (dayType === 'HOLIDAY') {
      this.attendance.previewHolidayImpact(from, to, csId).subscribe({
        next: (preview) => this.confirmAndDeclareHoliday(from, to, csId, reason!.trim(), preview),
        error: (err) => this.toast.error(err?.error?.error || 'Failed to check calendar impact'),
      });
    } else {
      this.dialog
        .open(ConfirmDialog, {
          data: `Mark ${this.dayCount()} day(s) as Working Day for ${scope === 'SCHOOL' ? 'the entire school' : this.sectionLabel(classSectionId!)}?`,
        })
        .afterClosed()
        .subscribe((confirmed) => { if (confirmed) this.applyWorkingDay(from, to, csId, reason!.trim()); });
    }
  }

  private confirmAndDeclareHoliday(from: string, to: string, classSectionId: number | undefined, reason: string, preview: HolidayImpactPreview) {
    const data: HolidayImpactConfirmDialogData = {
      scopeLabel: classSectionId ? this.sectionLabel(classSectionId) : 'the entire school',
      fromDate: from, toDate: to, dayCount: this.dayCount(), preview,
    };
    this.dialog.open(HolidayImpactConfirmDialog, { width: '480px', maxWidth: '95vw', data }).afterClosed().subscribe((confirmed) => {
      if (confirmed) this.applyHoliday(from, to, classSectionId, reason);
    });
  }

  private applyHoliday(from: string, to: string, classSectionId: number | undefined, reason: string) {
    this.submitting.set(true);
    this.attendance.declareHoliday({ fromDate: from, toDate: to, classSectionId, reason }).subscribe({
      next: (res) => { this.toast.success(res.message); this.declareForm.patchValue({ reason: '' }); this.loadEntries(); },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to declare holiday'),
      complete: () => this.submitting.set(false),
    });
  }

  private applyWorkingDay(from: string, to: string, classSectionId: number | undefined, reason: string) {
    this.submitting.set(true);
    this.attendance.setWorkingDayOverride({ fromDate: from, toDate: to, classSectionId, reason }).subscribe({
      next: (res) => { this.toast.success(res.message); this.declareForm.patchValue({ reason: '' }); this.loadEntries(); },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to set working day'),
      complete: () => this.submitting.set(false),
    });
  }

  deleteEntry(entry: CalendarEntry) {
    this.dialog
      .open(ConfirmDialog, { data: `Remove this ${entry.dayType === 'HOLIDAY' ? 'holiday' : 'working-day override'} entry for ${entry.date}? The date will revert to the default.` })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.attendance.removeCalendarOverride(entry.id).subscribe({
          next: () => { this.toast.success('Calendar entry removed'); this.loadEntries(); },
          error: (err) => this.toast.error(err?.error?.error || 'Failed to remove entry'),
        });
      });
  }

  sectionLabel(id: number): string {
    const cs = this.classSections().find((c) => c.id === id);
    return cs ? `${cs.className} - ${cs.sectionName}` : `Section #${id}`;
  }
}