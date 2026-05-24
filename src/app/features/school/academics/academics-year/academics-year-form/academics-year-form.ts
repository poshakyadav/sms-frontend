// src/app/features/school/academics/years/academics-year-form/academics-year-form.ts
//
// Standalone form component for creating and editing academic years.
//
// Key behaviours:
//  • Displays dates in DD/MM/YYYY format via IndianDateAdapter
//  • Sends yyyy-MM-dd to the backend using local date parts (avoids UTC shift in IST)
//  • Auto-fills the year name from the selected start date
//  • Guards against leaving with unsaved changes via CanDeactivate (see canDeactivate())

import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

import { AcademicsService } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { INDIAN_DATE_PROVIDERS } from '../../../../../core/adapters/indian-date-adapter';
import { BackButtonComponent } from '../../../../../shared/components/back-button/back-button';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AcademicYearPayload {
  name: string;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Converts a JS Date to a yyyy-MM-dd string using LOCAL date parts.
 *
 * Why not toISOString()?
 * In IST (UTC+5:30), new Date(2025, 3, 1).toISOString() returns
 * "2025-03-31T18:30:00.000Z" — one day behind.  Reading local parts
 * directly avoids this off-by-one in all non-UTC timezones.
 */
function toLocalISODate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-academics-year-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule, // required for NativeDateAdapter to be available
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    BackButtonComponent,
  ],
  providers: [
    DatePipe,
    ...INDIAN_DATE_PROVIDERS, // overrides MAT_DATE_FORMATS + DateAdapter for DD/MM/YYYY
  ],
  templateUrl: './academics-year-form.html',
  styleUrl: './academics-year-form.scss',
})
export class AcademicsYearForm implements OnInit {
  // ── DI ──────────────────────────────────────────────────────────────────────

  readonly router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);

  // ── State signals ────────────────────────────────────────────────────────────

  readonly isEdit = signal(false);
  readonly yearId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);

  // ── Form ─────────────────────────────────────────────────────────────────────

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{4}$/)]],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.yearId.set(+id);
      this.loadYear(+id);
    }
  }

  // ── CanDeactivate hook ───────────────────────────────────────────────────────

  /**
   * Called by a CanDeactivate guard to warn the user about unsaved changes.
   * Wire this up in your route config:
   *
   *   canDeactivate: [(c: AcademicsYearForm) => c.canDeactivate()]
   */
  canDeactivate(): boolean {
    if (this.form.dirty && !this.submitting()) {
      return confirm('You have unsaved changes. Leave anyway?');
    }
    return true;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private loadYear(id: number): void {
    this.loading.set(true);

    this.academicsService.getAcademicYearById(id).subscribe({
      next: (year) => {
        this.form.patchValue({
          name: year.name,
          // IndianDateAdapter.parse() handles both yyyy-MM-dd (backend)
          // and DD/MM/YYYY (user-typed) strings correctly.
          startDate: new Date(year.startDate),
          endDate: new Date(year.endDate),
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to load academic year');
        this.router.navigate(['/school/academics/years']);
      },
    });
  }

  private buildPayload(): AcademicYearPayload {
    const raw = this.form.getRawValue();
    return {
      name: raw.name!.trim(),
      startDate: toLocalISODate(raw.startDate as Date),
      endDate: toLocalISODate(raw.endDate as Date),
    };
  }

  // ── Event handlers ───────────────────────────────────────────────────────────

  /**
   * Auto-fill the year name when a start date is picked.
   * e.g.  startDate = 01/04/2025  →  name = "2025-2026"
   *
   * Only overwrites the field if it is empty or already matches
   * the auto-generated YYYY-YYYY pattern (i.e. the user hasn't
   * manually customised it).
   */
  onStartDateChange(date: Date | null): void {
    if (!date) return;

    const yr = date.getFullYear();
    const current = this.form.get('name')?.value ?? '';

    if (!current || /^\d{4}-\d{4}$/.test(current)) {
      this.form.patchValue({ name: `${yr}-${yr + 1}` });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const payload = this.buildPayload();
    const request$ = this.isEdit()
      ? this.academicsService.updateAcademicYear(this.yearId()!, payload)
      : this.academicsService.createAcademicYear(payload);

    request$.subscribe({
      next: () => {
        this.form.markAsPristine(); // clear dirty flag so canDeactivate doesn't fire
        this.toast.success(this.isEdit() ? 'Academic year updated!' : 'Academic year created!');
        this.router.navigate(['/school/academics/years']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save academic year');
        this.submitting.set(false);
      },
    });
  }
}
