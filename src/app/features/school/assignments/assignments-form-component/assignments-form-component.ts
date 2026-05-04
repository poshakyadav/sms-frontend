// assignments-form-component.ts

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { AcademicsService } from '../../../../core/services/academics.service';
import {
  AssignmentsService,
  CreateAssignmentPayload,
} from '../../../../core/services/assignments.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SubjectsService } from '../../../../core/services/subjects.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-assignments-form-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './assignments-form-component.html',
  styleUrl: './assignments-form-component.scss',
})
export class AssignmentsFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private assignmentsService = inject(AssignmentsService);
  private academics = inject(AcademicsService);
  private subjects = inject(SubjectsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  // ── State ──────────────────────────────────────────────────────────────────
  isEdit = signal(false);
  assignmentId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);
  teacherAssignments = signal<any[]>([]);
  classSections = signal<any[]>([]);

  // ── Form ───────────────────────────────────────────────────────────────────
  form = this.fb.group({
    teacherAssignmentId: [null as number | null, Validators.required],
    classSectionId: [null as number | null, Validators.required],
    type: ['ASSIGNMENT' as 'CLASS_WORK' | 'HOME_WORK' | 'ASSIGNMENT', Validators.required],
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    targetDate: [null as string | null],
    dueDate: [null as string | null],
    maxMarks: [null as number | null, [Validators.min(1), Validators.max(9999)]],
    isMandatory: [true],
  });

  get currentType(): string {
    return this.form.get('type')?.value ?? 'ASSIGNMENT';
  }

  ngOnInit(): void {
    this.loadDropdownData();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.assignmentId.set(+id);
      this.loadAssignment(+id);
    }

    // Swap validators on type change
    this.form.get('type')?.valueChanges.subscribe((type) => {
      const dueCtrl = this.form.get('dueDate');
      const targetCtrl = this.form.get('targetDate');

      if (type === 'ASSIGNMENT') {
        dueCtrl?.setValidators(Validators.required);
        targetCtrl?.clearValidators();
        targetCtrl?.setValue(null);
      } else {
        targetCtrl?.setValidators(Validators.required);
        dueCtrl?.clearValidators();
        dueCtrl?.setValue(null);
      }

      dueCtrl?.updateValueAndValidity();
      targetCtrl?.updateValueAndValidity();
    });
  }

  private loadDropdownData(): void {
    this.loading.set(true);

    const user = this.auth.schoolUser();
    if (!user) {
      this.toast.error('User not found');
      return;
    }

    // Load teacher's assigned subjects
    this.subjects.getTeacherAssignments(user.id).subscribe({
      next: (res) => this.teacherAssignments.set(res.assignments ?? []),
      error: () => this.toast.error('Failed to load your assigned subjects'),
    });

    // Load class-sections
    this.academics.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load class sections');
        this.loading.set(false);
      },
    });
  }

  private loadAssignment(id: number): void {
    this.loading.set(true);
    this.assignmentsService.getById(id).subscribe({
      next: (a) => {
        this.form.patchValue({
          teacherAssignmentId: a.teacherAssignmentId,
          classSectionId: a.classSectionId,
          type: a.type,
          title: a.title,
          description: a.description,
          targetDate: a.targetDate ?? null,
          dueDate: a.dueDate ?? null,
          maxMarks: a.maxMarks ?? null,
          isMandatory: a.isMandatory,
        });
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load assignment details');
        this.router.navigate(['/school/assignments/list']);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fill in all required fields correctly.');
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    const payload: CreateAssignmentPayload = {
      teacherAssignmentId: raw.teacherAssignmentId!,
      classSectionId: raw.classSectionId!,
      type: raw.type!,
      title: raw.title!.trim(),
      description: raw.description!.trim(),
      targetDate: raw.targetDate ?? null,
      dueDate: raw.dueDate ?? null,
      maxMarks: raw.maxMarks ?? null,
      isMandatory: !!raw.isMandatory,
    };

    const request$ = this.isEdit()
      ? this.assignmentsService.updateAssignment(this.assignmentId()!, payload)
      : this.assignmentsService.createAssignment(payload);

    request$.subscribe({
      next: () => {
        this.toast.success(
          this.isEdit() ? 'Assignment updated successfully!' : 'Assignment published successfully!'
        );
        this.router.navigate(['/school/assignments/list']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save assignment');
        this.submitting.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/school/assignments/list']);
  }
}
