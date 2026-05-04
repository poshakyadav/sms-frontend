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
  selector: 'app-class-form-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './class-form-component.html',
  styleUrl: './class-form-component.scss',
})
export class ClassFormComponent {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);

  form: FormGroup;
  isEdit = signal(false);
  classId = signal<number | null>(null);
  loading = signal(false);
  notFound = signal(false);

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(50)]],
      level: [0, [Validators.required, Validators.min(0), Validators.max(12)]],
      sort_order: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = +idParam;
      if (!isNaN(id) && id > 0) {
        this.isEdit.set(true);
        this.classId.set(id);
        this.loadClass(id);
      } else {
        this.toast.error('Invalid class ID');
        this.router.navigate(['/school/academics/classes']);
      }
    }
  }

  private loadClass(id: number): void {
    this.loading.set(true);
    this.academics.getClasses().subscribe({
      next: (res) => {
        const cls = res.classes.find((c) => c.id === id);
        if (cls) {
          this.form.patchValue(cls);
        } else {
          this.notFound.set(true);
          this.toast.error('Class not found');
          setTimeout(() => this.router.navigate(['/school/academics/classes']), 1500);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to load class');
        this.loading.set(false);
        this.router.navigate(['/school/academics/classes']);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill all required fields correctly');
      return;
    }

    this.loading.set(true);
    const data = this.form.getRawValue();

    const op = this.isEdit()
      ? this.academics.updateClass(this.classId()!, data)
      : this.academics.createClass(data);

    op.subscribe({
      next: () => {
        this.toast.success(this.isEdit() ? 'Class updated' : 'Class created');
        this.router.navigate(['/school/academics/classes']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save class');
        this.loading.set(false);
      },
    });
  }

  // Template helpers
  get nameControl() {
    return this.form.get('name');
  }
  get levelControl() {
    return this.form.get('level');
  }
  get sortOrderControl() {
    return this.form.get('sort_order');
  }
}
