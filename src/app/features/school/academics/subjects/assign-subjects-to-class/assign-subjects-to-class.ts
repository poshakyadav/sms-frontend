import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import {
  ClassSubject,
  SchoolSubject,
  SubjectsService,
} from '../../../../../core/services/subjects.service';
import { AcademicsService, ClassSection } from '../../../../../core/services/academics.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';

/**
 * ASSIGN SUBJECTS TO CLASS-SECTION
 *
 * Flow:
 * 1. User lands here from subjects list (route param = subjectId to pre-select).
 * 2. User picks a class-section from the dropdown.
 * 3. Component loads all subjects assigned to that class-section.
 * 4. User can add the pre-selected subject (or any other) or remove existing ones.
 * 5. "Assign Teachers" button navigates to the teacher-assignment page per class-subject.
 *
 * BUG FIX (mirrors the teacher-assignment component fix):
 * ────────────────────────────────────────────────────────
 * `takeUntilDestroyed(this.destroyRef)` throws when called inside methods
 * (loadDropdowns, loadAssignments, assignSubject, unassign) because Angular's
 * injection-context check fails at call time, not instantiation time.
 *
 * All method-level subscriptions now use `takeUntil(this.destroy$)` where
 * `destroy$` is a plain Subject that completes in ngOnDestroy.
 */
@Component({
  selector: 'app-assign-subjects-to-class',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './assign-subjects-to-class.html',
  styleUrl: './assign-subjects-to-class.scss',
})
export class AssignSubjectsToClassSection implements OnInit, OnDestroy {
  // ── DI ────────────────────────────────────────────────────────────────────
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly subjectsService = inject(SubjectsService);
  private readonly academicsService = inject(AcademicsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Lifetime teardown ─────────────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.subjects.manage'));
  canAssignTeacher = computed(() => this.auth.hasPermission('academics.assign-teacher'));

  // ── Dropdown data ─────────────────────────────────────────────────────────
  loadingDropdowns = signal(true);
  dropdownError = signal<string | null>(null);
  allClassSections = signal<ClassSection[]>([]);
  allSubjects = signal<SchoolSubject[]>([]);

  // ── Class-section selection ───────────────────────────────────────────────
  selectedClassSectionId = signal<number | null>(null);

  // ── Assignments for selected class-section ────────────────────────────────
  loadingAssignments = signal(false);
  assignmentError = signal<string | null>(null);
  assignedSubjects = signal<ClassSubject[]>([]);

  // ── Add-form state ────────────────────────────────────────────────────────
  showAddForm = signal(false);
  /** Pre-selected from the route param (subject clicked in the list). */
  selectedSubjectId = signal<number | null>(null);
  isMandatory = signal(true);
  addingSubject = signal(false);

  /** Subjects not yet assigned to the currently selected class-section. */
  availableSubjects = computed(() => {
    const assignedIds = new Set(this.assignedSubjects().map((s) => s.subjectId));
    return this.allSubjects().filter((s) => !assignedIds.has(s.id));
  });

  /** Display name of the selected class-section for the page subtitle. */
  selectedClassSectionName = computed(() => {
    const id = this.selectedClassSectionId();
    if (!id) return null;
    const cs = this.allClassSections().find((c) => c.id === id);
    return cs ? `${cs.className} – ${cs.sectionName}` : null;
  });

  readonly displayedColumns = ['subjectName', 'code', 'mandatory', 'actions'] as const;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const subjectParam = this.route.snapshot.paramMap.get('classId');
    const preSelectedSubjectId = subjectParam ? parseInt(subjectParam, 10) : null;

    this.loadDropdowns(
      preSelectedSubjectId && !isNaN(preSelectedSubjectId) ? preSelectedSubjectId : null
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  private loadDropdowns(preSelectedSubjectId: number | null): void {
    this.loadingDropdowns.set(true);
    this.dropdownError.set(null);

    forkJoin({
      classSections: this.academicsService.getClassSections(),
      subjects: this.subjectsService.getSubjects(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ classSections, subjects }) => {
          this.allClassSections.set(classSections.classSections ?? []);
          this.allSubjects.set(subjects.subjects ?? []);

          if (preSelectedSubjectId) {
            const exists = subjects.subjects?.some((s) => s.id === preSelectedSubjectId);
            if (exists) this.selectedSubjectId.set(preSelectedSubjectId);
          }

          this.loadingDropdowns.set(false);
        },
        error: (err) => {
          this.dropdownError.set(err?.message ?? 'Failed to load form data');
          this.loadingDropdowns.set(false);
        },
      });
  }

  onClassSectionChange(classSectionId: number | null): void {
    this.selectedClassSectionId.set(classSectionId);
    this.assignedSubjects.set([]);
    this.showAddForm.set(false);
    this.assignmentError.set(null);

    if (!classSectionId) return;
    this.loadAssignments(classSectionId);
  }

  private loadAssignments(classSectionId: number): void {
    this.loadingAssignments.set(true);
    this.assignmentError.set(null);

    this.subjectsService
      .getClassSectionSubjects(classSectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.assignedSubjects.set(res.subjects ?? []);
          this.loadingAssignments.set(false);

          // Auto-open add form if pre-selected subject is not yet assigned.
          const preId = this.selectedSubjectId();
          if (preId && !res.subjects?.some((s) => s.subjectId === preId)) {
            this.showAddForm.set(true);
          }
        },
        error: (err) => {
          this.assignmentError.set(err?.message ?? 'Failed to load subject assignments');
          this.loadingAssignments.set(false);
        },
      });
  }

  refreshAssignments(): void {
    const id = this.selectedClassSectionId();
    if (id) this.loadAssignments(id);
  }

  // ── Add subject ────────────────────────────────────────────────────────────
  toggleAddForm(): void {
    this.showAddForm.update((v) => !v);
    if (!this.showAddForm()) {
      this.selectedSubjectId.set(null);
      this.isMandatory.set(true);
    }
  }

  assignSubject(): void {
    const subjectId = this.selectedSubjectId();
    const classSectionId = this.selectedClassSectionId();
    if (!subjectId || !classSectionId || this.addingSubject()) return;

    this.addingSubject.set(true);

    this.subjectsService
      .assignSubjectToClass({ classSectionId, subjectId, isMandatory: this.isMandatory() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Subject assigned successfully');
          this.showAddForm.set(false);
          this.selectedSubjectId.set(null);
          this.isMandatory.set(true);
          this.addingSubject.set(false);
          this.refreshAssignments();
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to assign subject');
          this.addingSubject.set(false);
        },
      });
  }

  // ── Remove subject ─────────────────────────────────────────────────────────
  unassign(classSubject: ClassSubject): void {
    if (
      !confirm(
        `Remove "${classSubject.subjectName}" from this class-section?\n\nAny teacher assignments for this subject will also be removed.`
      )
    )
      return;

    this.subjectsService
      .unassignSubjectFromClass(classSubject.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Subject removed');
          this.assignedSubjects.update((l) => l.filter((s) => s.id !== classSubject.id));
        },
        error: (err) => this.toast.error(err?.message ?? 'Failed to remove subject'),
      });
  }

  // ── Navigate to teacher assignment ─────────────────────────────────────────
  /**
   * Navigate to teacher assignment for a specific class-section-subject.
   * Passes classSubject.id (the junction-table row), NOT subject.id.
   */
  assignTeachers(classSubject: ClassSubject): void {
    this.router.navigate(['/school/academics/subjects/assign-teacher', classSubject.id]);
  }
}
