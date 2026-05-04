import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AcademicsService, ClassSection } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';

/** Hard cap enforced on both frontend and backend. */
const MAX_CAPACITY = 50;

@Component({
  selector: 'app-class-section-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './class-section-form.html',
  styleUrl: './class-section-form.scss',
})
export class ClassSectionForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly academics = inject(AcademicsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly router = inject(Router);

  // ── Expose constant to template ────────────────────────────────────────────
  readonly maxCapacity = MAX_CAPACITY;

  // ── State ──────────────────────────────────────────────────────────────────
  form: FormGroup;
  isEdit = signal(false);
  sectionId = signal<number | null>(null);
  loadingForm = signal(true); // loading dropdown data (+ existing record in edit mode)
  submitting = signal(false);
  notFound = signal(false);

  // ── Dropdown data ──────────────────────────────────────────────────────────
  classes = signal<any[]>([]);
  sections = signal<any[]>([]);
  teachers = signal<any[]>([]);

  constructor() {
    this.form = this.fb.group({
      classId: [null, Validators.required],
      sectionId: [null, Validators.required],
      capacity: [
        40,
        [
          Validators.required,
          Validators.min(1),
          Validators.max(MAX_CAPACITY), // ← enforced max 50
        ],
      ],
      classTeacherId: [null],
      roomNumber: ['', Validators.maxLength(20)],
      isActive: [true],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      const id = +idParam;
      if (!isNaN(id) && id > 0) {
        this.isEdit.set(true);
        this.sectionId.set(id);
        this.loadFormData(id);
      } else {
        this.toast.error('Invalid class-section ID');
        this.router.navigate(['/school/academics/class-sections']);
      }
    } else {
      // Create mode — only need dropdowns
      this.loadFormData(null);
    }
  }

  /**
   * Loads dropdown data in parallel.
   * In edit mode also fetches the existing class-section record and patches the form.
   */
  private loadFormData(editId: number | null): void {
    this.loadingForm.set(true);

    forkJoin({
      classes: this.academics.getClasses(),
      sections: this.academics.getSections(),
      teachers: this.academics.getTeachers(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ classes, sections, teachers }) => {
          this.classes.set(classes.classes ?? []);
          this.sections.set(sections.sections ?? []);
          this.teachers.set(teachers.teachers ?? []);

          if (editId !== null) {
            this.patchExistingSection(editId);
          } else {
            this.loadingForm.set(false);
          }
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to load form data');
          this.loadingForm.set(false);
        },
      });
  }

  /**
   * Finds the class-section from the already-loaded list and patches the form.
   * Uses getClassSections() — same call the list page uses — so no extra API needed.
   */
  private patchExistingSection(id: number): void {
    this.academics
      .getClassSections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const cs = (res.classSections ?? []).find((s: ClassSection) => s.id === id);

          if (!cs) {
            this.notFound.set(true);
            this.toast.error('Class-section not found');
            setTimeout(() => this.router.navigate(['/school/academics/class-sections']), 1500);
            this.loadingForm.set(false);
            return;
          }

          this.form.patchValue({
            classId: cs.classId,
            sectionId: cs.sectionId,
            capacity: Math.min(cs.capacity, MAX_CAPACITY), // clamp in case DB has legacy value
            classTeacherId: cs.classTeacherId ?? null,
            roomNumber: cs.roomNumber ?? '',
            isActive: cs.isActive,
          });

          this.loadingForm.set(false);
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to load class-section data');
          this.loadingForm.set(false);
          this.router.navigate(['/school/academics/class-sections']);
        },
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill all required fields correctly');
      return;
    }

    this.submitting.set(true);
    const payload = this.form.getRawValue();

    const op$ = this.isEdit()
      ? this.academics.updateClassSection(this.sectionId()!, payload)
      : this.academics.createClassSection(payload);

    op$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(
          this.isEdit()
            ? 'Class-section updated successfully'
            : 'Class-section created successfully'
        );
        this.router.navigate(['/school/academics/class-sections']);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save class-section');
        this.submitting.set(false);
      },
    });
  }

  // ── Template helpers ───────────────────────────────────────────────────────
  get classControl() {
    return this.form.get('classId');
  }
  get sectionControl() {
    return this.form.get('sectionId');
  }
  get capacityControl() {
    return this.form.get('capacity');
  }
}
