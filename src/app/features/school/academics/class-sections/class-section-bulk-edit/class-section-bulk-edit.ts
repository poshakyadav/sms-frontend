// class-section-bulk-edit.ts
import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
  DestroyRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { AcademicsService, ClassSection } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { TeacherSearchDropdownComponent } from '../teacher-search-dropdown/teacher-search-dropdown';

const MAX_CAPACITY = 50;

@Component({
  selector: 'app-class-section-bulk-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule,
    TeacherSearchDropdownComponent,
  ],
  templateUrl: './class-section-bulk-edit.html',
  styleUrl: './class-section-bulk-edit.scss',
})
export class ClassSectionBulkEdit implements OnInit {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  readonly router = inject(Router);

  readonly maxCapacity = MAX_CAPACITY;

  // ── State ──────────────────────────────────────────────────────────────────
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  dirtyRows = signal<Set<number>>(new Set());

  // ── Dropdown data ──────────────────────────────────────────────────────────
  teachers = signal<any[]>([]);

  originalSections: ClassSection[] = [];

  // ── Form ───────────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({ rows: this.fb.array([]) });

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }

  dirtyCount = computed(() => this.dirtyRows().size);
  hasChanges = computed(() => this.dirtyRows().size > 0);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      sections: this.academics.getClassSections(),
      teachers: this.academics.getTeachers(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ sections, teachers }) => {
          this.originalSections = sections.classSections ?? [];
          this.teachers.set(teachers.teachers ?? []);
          this.buildForm(this.originalSections);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load data');
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private buildForm(sections: ClassSection[]): void {
    this.rows.clear();
    this.dirtyRows.set(new Set());

    sections.forEach((cs) => {
      const group = this.fb.group({
        id: [cs.id],
        capacity: [
          Math.min(cs.capacity, MAX_CAPACITY),
          [Validators.required, Validators.min(1), Validators.max(MAX_CAPACITY)],
        ],
        classTeacherId: [cs.classTeacherId ?? null],
        roomNumber: [cs.roomNumber ?? '', Validators.maxLength(20)],
        isActive: [cs.isActive],
      });

      // Track dirty
      group.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        const idx = this.rows.controls.indexOf(group);
        if (idx === -1) return;
        const orig = this.originalSections[idx];
        const curr = group.getRawValue();

        const changed =
          Number(curr.capacity) !== Number(orig?.capacity) ||
          curr.classTeacherId !== (orig?.classTeacherId ?? null) ||
          (curr.roomNumber ?? '') !== (orig?.roomNumber ?? '') ||
          curr.isActive !== orig?.isActive;

        this.dirtyRows.update((set) => {
          const next = new Set(set);
          if (changed) next.add(idx);
          else next.delete(idx);
          return next;
        });
      });

      this.rows.push(group);
    });

    this.cdr.markForCheck();
  }

  // ── Teacher selection from searchable dropdown ─────────────────────────────
  onTeacherSelected(teacherId: number | null, rowIndex: number): void {
    this.rowAt(rowIndex).get('classTeacherId')?.setValue(teacherId);
  }

  // ── Reset helpers ──────────────────────────────────────────────────────────
  resetRow(index: number): void {
    const orig = this.originalSections[index];
    if (!orig) return;
    this.rowAt(index).patchValue(
      {
        capacity: Math.min(orig.capacity, MAX_CAPACITY),
        classTeacherId: orig.classTeacherId ?? null,
        roomNumber: orig.roomNumber ?? '',
        isActive: orig.isActive,
      },
      { emitEvent: false }
    );
    this.dirtyRows.update((set) => {
      const next = new Set(set);
      next.delete(index);
      return next;
    });
    this.cdr.markForCheck();
  }

  resetAll(): void {
    this.buildForm(this.originalSections);
    this.toast.success('All changes discarded');
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix validation errors before saving');
      return;
    }

    if (!this.hasChanges()) {
      this.toast.warning('No changes to save');
      return;
    }

    const allRows = this.rows.getRawValue();
    const changedItems = allRows
      .filter((_: any, i: number) => this.dirtyRows().has(i))
      .map((row: any) => ({
        id: Number(row.id),
        capacity: Number(row.capacity),
        classTeacherId: row.classTeacherId ?? null,
        roomNumber: row.roomNumber || null,
        isActive: Boolean(row.isActive),
      }));

    this.submitting.set(true);

    this.academics.bulkUpdateClassSections(changedItems).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.submitting.set(false);

        if (res.notFound?.length > 0) {
          this.toast.warning(`${res.notFound.length} section ID(s) not found on server`);
        }

        // Reload to re-sync originals
        forkJoin({
          sections: this.academics.getClassSections(),
          teachers: this.academics.getTeachers(),
        })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: ({ sections, teachers }) => {
              this.originalSections = sections.classSections ?? [];
              this.teachers.set(teachers.teachers ?? []);
              this.buildForm(this.originalSections);
              this.cdr.markForCheck();
            },
          });
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? 'Failed to update class-sections');
        this.submitting.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  isRowDirty(index: number): boolean {
    return this.dirtyRows().has(index);
  }

  fieldError(ctrl: AbstractControl | null, err: string): boolean {
    return !!(ctrl?.hasError(err) && ctrl?.touched);
  }

  trackById(_: number, ctrl: AbstractControl): number {
    return ctrl.get('id')?.value;
  }

  getTeacherName(teacherId: number | null): string {
    if (!teacherId) return '—';
    return this.teachers().find((t) => t.id === teacherId)?.name ?? '—';
  }
}
