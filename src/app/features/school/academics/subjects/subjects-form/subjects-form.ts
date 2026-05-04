import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { SchoolSubject, SubjectsService } from '../../../../../core/services/subjects.service';
import { ToastService } from '../../../../../core/services/toast.service';

/** Reusable validator: value must be at least `min` characters (ignoring whitespace). */
function minCharsValidator(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = (control.value ?? '').trim();
    // Allow empty — pair with Validators.required if the field is mandatory
    if (!value) return null;
    return value.length >= min ? null : { minChars: { required: min, actual: value.length } };
  };
}

@Component({
  selector: 'app-subjects-form',
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
  templateUrl: './subjects-form.html',
  styleUrl: './subjects-form.scss',
})
export class SubjectsForm implements OnInit {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private subjectsService = inject(SubjectsService);
  private toast = inject(ToastService);

  isEdit = signal(false);
  subjectId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    code: [
      '',
      [
        minCharsValidator(3), // ← must be ≥ 3 chars when provided
        Validators.maxLength(10),
      ],
    ],
    description: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.subjectId.set(+id);
      this.loadSubject(+id);
    }
  }

  private loadSubject(id: number): void {
    this.loading.set(true);
    this.subjectsService.getSubjects().subscribe({
      next: (res) => {
        const subject = res.subjects.find((s) => s.id === id);
        if (subject) {
          this.form.patchValue({
            name: subject.name,
            code: subject.code ?? '',
            description: subject.description ?? '',
          });
        } else {
          this.toast.error('Subject not found');
          this.router.navigate(['/school/academics/subjects']);
        }
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load subject');
        this.router.navigate(['/school/academics/subjects']);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const raw = this.form.value;
    const payload: Partial<SchoolSubject> = {
      name: raw.name!.trim(),
      code: raw.code?.trim() || undefined,
      description: raw.description?.trim() || undefined,
    };

    const obs = this.isEdit()
      ? this.subjectsService.updateSubject(this.subjectId()!, payload)
      : this.subjectsService.createSubject(payload);

    obs.subscribe({
      next: () => {
        this.toast.success(this.isEdit() ? 'Subject updated!' : 'Subject created!');
        this.router.navigate(['/school/academics/subjects']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save subject');
        this.submitting.set(false);
      },
    });
  }
}
