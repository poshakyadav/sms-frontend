// missing-attendance-component.ts

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import { AttendanceService, MissingAttendanceDate } from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { INDIAN_DATE_PROVIDERS } from '../../../../core/adapters/indian-date-adapter';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-missing-attendance',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS], 
  templateUrl: './missing-attendance-component.html',
  styleUrl: './missing-attendance-component.scss',
})
export class MissingAttendanceComponent {
  private attendance = inject(AttendanceService);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  classSections = signal<ClassSection[]>([]);
  missing = signal<MissingAttendanceDate[]>([]);
  loading = signal(false);
  searched = signal(false);

  form = this.fb.group({
    fromDate: [this.defaultFrom()],
    toDate: [new Date()],
    classSectionId: [null as number | null],
  });

  groupedByDate = computed(() => {
    const map = new Map<string, MissingAttendanceDate[]>();
    for (const m of this.missing()) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  });

  constructor() {
    this.academics.getClassSections()
      .pipe(takeUntilDestroyed())
      .subscribe((res) => this.classSections.set(res.classSections));
    this.search();
  }

  private defaultFrom(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

  search() {
    const { fromDate, toDate, classSectionId } = this.form.value;
    if (!fromDate || !toDate) return;
    const from = this.datePipe.transform(fromDate, 'yyyy-MM-dd')!;
    const to = this.datePipe.transform(toDate, 'yyyy-MM-dd')!;
    this.loading.set(true);
    this.attendance.getMissingAttendance(from, to, classSectionId ?? undefined).subscribe({
      next: (res) => { this.missing.set(res.missing); this.searched.set(true); },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to load missing attendance report'),
      complete: () => this.loading.set(false),
    });
  }

  // same pattern as ManageCalendarComponent.sectionLabel(),
  // builds "Class – Section" from the classSections list instead of
  // trusting whatever partial string the backend sent for className.
  sectionLabel(m: MissingAttendanceDate): string {
    const cs = this.classSections().find((c) => c.id === m.classSectionId);
    if (cs) return `${cs.className} – ${cs.sectionName}`;
    // fall back to whatever the backend gave us, and only as a last
    // resort show the raw id so a row is never rendered blank
    return m.className?.trim() || `Section #${m.classSectionId}`;
  }

  goMark(m: MissingAttendanceDate) {
    this.router.navigate(['/school/attendance/mark'], { queryParams: { classSectionId: m.classSectionId, date: m.date } });
  }
}