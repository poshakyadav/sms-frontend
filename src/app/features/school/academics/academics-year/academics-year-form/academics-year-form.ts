import { CommonModule } from '@angular/common';
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
    MatNativeDateModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './academics-year-form.html',
  styleUrl: './academics-year-form.scss',
})
export class AcademicsYearForm implements OnInit {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private service = inject(AcademicsService);
  private toast = inject(ToastService);

  isEdit = signal(false);
  yearId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{4}$/)]],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.yearId.set(+id);
      this.loadYear(+id);
    }
  }

  private loadYear(id: number): void {
    this.loading.set(true);
    this.service.getAcademicYearById(id).subscribe({
      next: (year) => {
        this.form.patchValue({
          name: year.name,
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

  /** Auto-fill name from picked dates, e.g. startDate=2025 → "2025-2026" */
  onStartDateChange(date: Date | null): void {
    if (!date) return;
    const yr = date.getFullYear();
    const current = this.form.get('name')?.value;
    // Only auto-fill if field is empty or was previously auto-filled
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

    const raw = this.form.value;
    const payload = {
      name: raw.name!.trim(),
      startDate: (raw.startDate as Date).toISOString().split('T')[0],
      endDate: (raw.endDate as Date).toISOString().split('T')[0],
    };

    const obs = this.isEdit()
      ? this.service.updateAcademicYear(this.yearId()!, payload)
      : this.service.createAcademicYear(payload);

    obs.subscribe({
      next: () => {
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
