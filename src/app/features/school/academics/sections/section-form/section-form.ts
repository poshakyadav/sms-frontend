import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-section-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './section-form.html',
  styleUrl: './section-form.scss',
})
export class SectionForm {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);

  form: FormGroup;
  isEdit = signal(false);
  sectionId = signal<number | null>(null);
  loading = signal(false);

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(50)]],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.sectionId.set(+id);
      this.loadSection(+id);
    }
  }

  private loadSection(id: number): void {
    this.loading.set(true);
    this.academics.getSections().subscribe({
      next: (res) => {
        const sec = res.sections.find((s) => s.id === id);
        if (sec) {
          this.form.patchValue(sec);
        } else {
          this.toast.error('Section not found');
          this.router.navigate(['/school/academics/sections']);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/school/academics/sections']);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    const op = this.isEdit()
      ? this.academics.updateSection(this.sectionId()!, this.form.value)
      : this.academics.createSection(this.form.value);

    op.subscribe({
      next: () => {
        this.toast.success(this.isEdit() ? 'Section updated' : 'Section created');
        this.router.navigate(['/school/academics/sections']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save');
        this.loading.set(false);
      },
    });
  }
}
