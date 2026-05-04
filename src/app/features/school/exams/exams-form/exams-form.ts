// src/app/features/school/exams/exams-form/exams-form.ts

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
// import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { AcademicsService } from '../../../../core/services/academics.service';
import { ExamsService } from '../../../../core/services/exams.service';
import { SubjectsService } from '../../../../core/services/subjects.service';
import { ToastService } from '../../../../core/services/toast.service';
import { INDIAN_DATE_PROVIDERS } from '../../../../core/adapters/indian-date-adapter';

/**
 * Pre-defined exam-type quick links shown beneath the free-text type input.
 * Clicking a chip fills the input — staff are not restricted to these values.
 */
const PRESET_EXAM_TYPES: string[] = [
  'Mid Term',
  'Final Exam',
  'Quiz',
  'Unit Test',
  'Pre-Board',
  'Half Yearly',
  'Annual',
  'Practical',
  'Oral',
  'PTM Assessment',
];

@Component({
  selector: 'app-exams-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    // MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './exams-form.html',
  styleUrl: './exams-form.scss',
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
})
export class ExamsForm implements OnInit {
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private examsService = inject(ExamsService);
  private academics = inject(AcademicsService);
  private subjects = inject(SubjectsService);
  private toast = inject(ToastService);

  isEdit = signal(false);
  examId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);

  classSections = signal<any[]>([]);
  academicYears = signal<any[]>([]);
  classSubjects = signal<any[]>([]);

  /** Exposed so the template can render the quick-link chips */
  readonly presetExamTypes = PRESET_EXAM_TYPES;

  form = this.fb.group({
    academicYearId: [null as number | null, Validators.required],
    classSectionId: [null as number | null, Validators.required],
    name: ['', [Validators.required, Validators.minLength(3)]],
    // ── Free-text type (no longer a fixed enum) ───────────────────────────
    type: ['', [Validators.required, Validators.maxLength(60)]],
    description: [''],
    subjects: this.fb.array([]),
  });

  get subjectsArray(): FormArray {
    return this.form.get('subjects') as FormArray;
  }

  ngOnInit(): void {
    this.loadOptions();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.examId.set(+id);
      this.loadExam(+id);
    } else {
      this.addSubjectRow();
    }

    this.form.get('classSectionId')?.valueChanges.subscribe((csId) => {
      if (csId) this.loadClassSubjects(csId);
    });
  }

  // ── Preset type quick link ────────────────────────────────────────────────

  /** Called when user clicks a preset chip — fills the type input field */
  applyPreset(preset: string): void {
    this.form.get('type')!.setValue(preset);
    this.form.get('type')!.markAsDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────

  private loadOptions(): void {
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections ?? []),
      error: () => this.toast.error('Failed to load class sections'),
    });

    this.academics.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years ?? []),
      error: () => this.toast.error('Failed to load academic years'),
    });
  }

  private loadClassSubjects(classSectionId: number): void {
    this.subjects.getClassSectionSubjects(classSectionId).subscribe({
      next: (res) => this.classSubjects.set(res.subjects ?? []),
      error: () => this.toast.error('Failed to load subjects for this class-section'),
    });
  }

  private loadExam(id: number): void {
    this.loading.set(true);
    this.examsService.getById(id).subscribe({
      next: (exam) => {
        this.form.patchValue({
          academicYearId: exam.academicYearId,
          classSectionId: exam.classSectionId,
          name: exam.name,
          type: exam.type,
          description: exam.description ?? '',
        });

        if (exam.classSectionId) this.loadClassSubjects(exam.classSectionId);

        this.subjectsArray.clear();
        (exam.timetable ?? []).forEach((t) => {
          this.subjectsArray.push(this.buildSubjectRow(t));
        });

        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load exam');
        this.router.navigate(['/school/exams/list']);
      },
    });
  }

  private buildSubjectRow(t?: any) {
    return this.fb.group({
      classSubjectId: [t?.classSubjectId ?? null, Validators.required],
      date: [t?.date ?? null, Validators.required],
      startTime: [t?.startTime ?? ''],
      endTime: [t?.endTime ?? ''],
      roomNumber: [t?.roomNumber ?? ''],
      maxMarks: [t?.maxMarks ?? 100, [Validators.required, Validators.min(1)]],
      passingMarks: [t?.passingMarks ?? 40],
      // ── NEW: optional custom paper label ──────────────────────────────
      subjectLabel: [t?.subjectLabel ?? '', Validators.maxLength(120)],
    });
  }

  addSubjectRow(): void {
    this.subjectsArray.push(this.buildSubjectRow());
  }

  removeSubjectRow(index: number): void {
    if (this.subjectsArray.length > 1) {
      this.subjectsArray.removeAt(index);
    } else {
      this.toast.warning('At least one subject is required');
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill in all required fields');
      return;
    }

    this.submitting.set(true);
    const raw = this.form.value;

    const subjects = (raw.subjects ?? []).map((s: any) => ({
      ...s,
      date: s.date ? (s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date) : null,
      // Send null when empty so the backend stores NULL (falls back to canonical name)
      subjectLabel: s.subjectLabel?.trim() || null,
    }));

    const payload = {
      academicYearId: raw.academicYearId!,
      classSectionId: raw.classSectionId!,
      name: raw.name!.trim(),
      type: raw.type!.trim(),
      description: raw.description?.trim() ?? '',
      subjects,
    };

    const obs = this.isEdit()
      ? this.examsService.updateExam(this.examId()!, payload)
      : this.examsService.createExam(payload);

    obs.subscribe({
      next: () => {
        this.toast.success(this.isEdit() ? 'Exam updated!' : 'Exam created!');
        this.router.navigate(['/school/exams/list']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save exam');
        this.submitting.set(false);
      },
    });
  }
}
