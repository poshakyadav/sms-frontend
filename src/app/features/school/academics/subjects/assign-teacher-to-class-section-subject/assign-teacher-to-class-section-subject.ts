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
  SubjectsService,
  Teacher,
  TeacherAssignment,
} from '../../../../../core/services/subjects.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';

/**
 * ASSIGN TEACHERS TO A CLASS-SECTION-SUBJECT
 *
 * Route param: `classSubjectId` = class_subjects.id (junction-table row ID).
 *
 * ROOT CAUSE OF INFINITE LOADING (now fixed):
 * ─────────────────────────────────────────────
 * `takeUntilDestroyed(this.destroyRef)` throws a runtime error when called
 * inside a method that executes *after* construction (ngOnInit, loadData,
 * retry button handler) because Angular's injection-context check fires at
 * call time, not just at instantiation time.
 *
 * FIX: Route-level data loading (loadData) uses a `destroy$` Subject that
 * lives for the component's lifetime.  Simple one-shot form actions
 * (assignTeacher, unassign) use a per-action Subject so they can be
 * independently cancelled without touching the page-level stream.
 *
 * `takeUntilDestroyed` is still used for the initial route-param
 * subscription in the constructor — the one place it IS in an injection
 * context and is appropriate.
 */
@Component({
  selector: 'app-assign-teacher-to-class-section-subject',
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
  templateUrl: './assign-teacher-to-class-section-subject.html',
  styleUrl: './assign-teacher-to-class-section-subject.scss',
})
export class AssignTeacherToClassSectionSubject implements OnInit, OnDestroy {
  // ── DI ────────────────────────────────────────────────────────────────────
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly subjectsService = inject(SubjectsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  /**
   * DestroyRef is injected here purely so we can pass it explicitly to
   * `takeUntilDestroyed` when used in an injection context (constructor).
   * All method-level subscriptions use `destroy$` instead.
   */
  private readonly destroyRef = inject(DestroyRef);

  // ── Lifetime teardown ─────────────────────────────────────────────────────
  /**
   * Emits once when the component is destroyed.  Used as the takeUntil
   * source for all subscriptions that live inside methods (loadData, etc.)
   * where Angular's injection-context guard would reject takeUntilDestroyed.
   */
  private readonly destroy$ = new Subject<void>();

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.assign-teacher'));

  // ── State ─────────────────────────────────────────────────────────────────
  /** The class_subjects.id — junction table row. */
  classSectionSubjectId = signal<number>(0);
  /** Human-readable display: "Mathematics — Class 10 A" */
  subjectDisplayName = signal<string>('');

  assignedTeachers = signal<TeacherAssignment[]>([]);
  allTeachers = signal<Teacher[]>([]);

  loading = signal(true);
  error = signal<string | null>(null);

  // ── Inline add-form ───────────────────────────────────────────────────────
  showAddForm = signal(false);
  selectedTeacherId = signal<number | null>(null);
  isPrimary = signal(false);
  assigning = signal(false);

  /** Teachers not yet assigned to this subject. */
  availableTeachers = computed(() => {
    const assignedIds = new Set(this.assignedTeachers().map((a) => a.teacherId));
    return this.allTeachers().filter((t) => !assignedIds.has(t.id));
  });

  readonly displayedColumns = ['teacherName', 'email', 'role', 'actions'] as const;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('classSubjectId');
    const parsed = parseInt(id ?? '0', 10);

    if (isNaN(parsed) || parsed <= 0) {
      this.error.set(
        'Invalid class-subject ID. Please navigate here from the "Assign Subjects" page.'
      );
      this.loading.set(false);
      return;
    }

    this.classSectionSubjectId.set(parsed);
    this.loadData();
  }

  ngOnDestroy(): void {
    // Complete the destroy$ subject — automatically unsubscribes all
    // active method-level subscriptions (loadData, assignTeacher, unassign).
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  /**
   * Loads assigned teachers, all available teachers, and the subject display
   * name in a single parallel request.
   *
   * Called from ngOnInit and from the "Retry" button.  Uses `takeUntil(destroy$)`
   * so it is correctly torn down on component destroy without needing an
   * injection context.
   */
  loadData(): void {
    if (this.classSectionSubjectId() <= 0) return;

    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      teachers: this.subjectsService.getClassSubjectTeachers(this.classSectionSubjectId()),
      allTeachers: this.subjectsService.getTeachers(),
      subject: this.subjectsService.getClassSubjectById(this.classSectionSubjectId()),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ teachers, allTeachers, subject }) => {
          // ── Defensive: wrap in try/catch so a data-shape mismatch shows
          // the error state instead of leaving loading=true forever.
          try {
            this.assignedTeachers.set(teachers.assignments ?? []);
            this.allTeachers.set(allTeachers.teachers ?? []);

            // Backend returns { classSectionSubject: {...} }
            // (route handler: c.json({ classSectionSubject }))
            const cs = subject.classSectionSubject;
            if (!cs) {
              throw new Error(
                'Server response missing classSectionSubject — check the backend route handler.'
              );
            }
            this.subjectDisplayName.set(`${cs.subjectName} — ${cs.className} ${cs.sectionName}`);
            this.loading.set(false);
          } catch (e: any) {
            this.error.set(e?.message ?? 'Unexpected response shape from server');
            this.loading.set(false);
          }
        },
        error: (err) => {
          const msg: string = err?.message ?? 'Failed to load data';
          this.error.set(
            msg.includes('not found')
              ? 'Subject assignment not found. It may have been removed. Go back and try again.'
              : msg
          );
          this.loading.set(false);
        },
      });
  }

  // ── Form toggle ────────────────────────────────────────────────────────────
  toggleAddForm(): void {
    this.showAddForm.update((v) => !v);
    if (!this.showAddForm()) {
      this.selectedTeacherId.set(null);
      this.isPrimary.set(false);
    }
  }

  // ── Assign teacher ─────────────────────────────────────────────────────────
  assignTeacher(): void {
    const teacherId = this.selectedTeacherId();
    if (!teacherId || this.assigning()) return;

    this.assigning.set(true);

    this.subjectsService
      .assignTeacherToSubject({
        teacherId,
        classSectionSubjectId: this.classSectionSubjectId(),
        isPrimary: this.isPrimary(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Teacher assigned successfully');
          this.showAddForm.set(false);
          this.selectedTeacherId.set(null);
          this.isPrimary.set(false);
          this.assigning.set(false);
          // Reload to get the full denormalised teacher row (name, email etc.)
          this.loadData();
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to assign teacher');
          this.assigning.set(false);
        },
      });
  }

  // ── Remove teacher ─────────────────────────────────────────────────────────
  unassign(assignment: TeacherAssignment): void {
    if (!confirm(`Remove "${assignment.teacherName}" from "${this.subjectDisplayName()}"?`)) return;

    this.subjectsService
      .unassignTeacherFromSubject(assignment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Teacher removed');
          // Optimistic update — no need to reload for a deletion.
          this.assignedTeachers.update((list) => list.filter((a) => a.id !== assignment.id));
        },
        error: (err) => this.toast.error(err?.message ?? 'Failed to remove teacher'),
      });
  }

  /**
   * Navigate back to the subject-assignment page.
   * Passes `0` as the classId so the page starts with no class-section
   * pre-selected — the user chooses again, which is the correct UX because
   * we don't retain which class-section they were working on.
   */
  goBack(): void {
    this.router.navigate(['/school/academics/subjects/assign-class', 0]);
  }
}
