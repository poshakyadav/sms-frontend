// class-section-bulk-create.ts
import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  DestroyRef,
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
import { MatRippleModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AcademicsService, Class, Section } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { TeacherSearchDropdownComponent } from '../teacher-search-dropdown/teacher-search-dropdown';

/** Hard cap — must match backend. */
const MAX_CAPACITY = 100;

// ─────────────────────────────────────────────────────────────────────────────
// PRESET LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkCSRow {
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  capacity: number;
  classTeacherId: number | null;
  roomNumber: string;
  isActive: boolean;
}

/** Generates all classId × sectionId combinations (cartesian product). */
function cartesianProduct(classes: Class[], sections: Section[]): BulkCSRow[] {
  const rows: BulkCSRow[] = [];
  for (const cls of classes) {
    for (const sec of sections) {
      rows.push({
        classId: cls.id,
        className: cls.name,
        sectionId: sec.id,
        sectionName: sec.name,
        capacity: 40,
        classTeacherId: null,
        roomNumber: '',
        isActive: true,
      });
    }
  }
  return rows;
}

// ── Stable UID counter ──────────────────────────────────────────────────────
// Each FormGroup gets a _uid so @for can track by identity, not index.
// This fixes the "bottom row deleted instead of middle row" bug caused by
// tracking with $index: when you remove row 1 of 3, index-based tracking
// re-uses the index, so Angular diffs the wrong DOM node.
let _uidCounter = 0;
function nextUid(): number {
  return ++_uidCounter;
}

@Component({
  selector: 'app-class-section-bulk-create',
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
    MatRippleModule,
    MatSelectModule,
    MatCheckboxModule,
    TeacherSearchDropdownComponent,
  ],
  templateUrl: './class-section-bulk-create.html',
  styleUrl: './class-section-bulk-create.scss',
})
export class ClassSectionBulkCreate implements OnInit {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  readonly router = inject(Router);

  readonly maxCapacity = MAX_CAPACITY;

  // ── Loading / submit state ─────────────────────────────────────────────────
  loadingData = signal(true);
  loadError = signal<string | null>(null);
  submitting = signal(false);
  lastResult = signal<{ created: number; skipped: string[] } | null>(null);

  // ── Dropdown data ──────────────────────────────────────────────────────────
  classes = signal<Class[]>([]);
  sections = signal<Section[]>([]);
  teachers = signal<any[]>([]);

  // ── UI toggles ─────────────────────────────────────────────────────────────
  showPresets = signal(false);
  showGuide = signal(false);

  // ── Preset selection state ─────────────────────────────────────────────────
  selectedClassIds = signal<Set<number>>(new Set());
  selectedSectionIds = signal<Set<number>>(new Set());

  // ── Form ───────────────────────────────────────────────────────────────────
  // IMPORTANT: we keep a single FormGroup reference for the lifetime of the
  // component so [formGroup]="form" never points at a stale object.
  // _rebuildFromRows used to replace this.form entirely — that broke two-way
  // binding with ChangeDetectionStrategy.OnPush (form.invalid stayed stale).
  // Now we only mutate the inner FormArray.
  form: FormGroup = this.fb.group({ rows: this.fb.array([]) });

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }

  // rowCount as a plain getter — safe to use in template expressions
  get rowCount(): number {
    return this.rows.length;
  }

  // ── Uid tracking helper — exposes (uid) from each FormGroup for @for track ─
  // Angular's @for needs a function; we store uid directly on the group.
  getUid(fg: AbstractControl): number {
    return (fg as any)._uid as number;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
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
          this.loadingData.set(false);

          // Seed with one empty row
          this._refillRows([{}]);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadError.set(err?.message ?? 'Failed to load form data');
          this.loadingData.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  // ── Row builders ───────────────────────────────────────────────────────────
  private _emptyRow(data?: Partial<BulkCSRow>): FormGroup {
    const fg = this.fb.group({
      classId: [data?.classId ?? null, Validators.required],
      sectionId: [data?.sectionId ?? null, Validators.required],
      capacity: [
        data?.capacity ?? 40,
        [Validators.required, Validators.min(1), Validators.max(MAX_CAPACITY)],
      ],
      classTeacherId: [data?.classTeacherId ?? null],
      roomNumber: [data?.roomNumber ?? '', Validators.maxLength(20)],
      isActive: [data?.isActive ?? true],
    });
    // Attach a stable uid for identity-based tracking in @for
    (fg as any)._uid = nextUid();
    return fg;
  }

  /**
   * Clears and refills the existing FormArray without replacing this.form.
   *
   * Key fix for Issue 2: replacing `this.form` broke the [formGroup]="form"
   * binding — the template kept a reference to the old FormGroup, so
   * form.invalid never updated. Mutating the existing FormArray preserves
   * the binding.
   *
   * emitEvent: false suppresses intermediate valueChanges/statusChanges
   * during the clear + refill loop so we don't get spurious change events.
   */
  private _refillRows(rows: Partial<BulkCSRow>[]): void {
    // Clear all existing controls without emitting (avoids N status events)
    while (this.rows.length > 0) {
      this.rows.removeAt(0, { emitEvent: false });
    }
    for (const r of rows) {
      this.rows.push(this._emptyRow(r), { emitEvent: false });
    }
    // Single emit after all rows are added
    this.rows.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  addRow(): void {
    this.rows.push(this._emptyRow());
    this.cdr.markForCheck();
  }

  /**
   * Fix for Issue 3: pass the actual index received from the @for loop.
   * Because we now track by uid (not $index), Angular correctly removes
   * the DOM node that matches the uid — so deleting row 1 of 3 removes
   * row 1's DOM, not row 3's.
   */
  removeRow(i: number): void {
    if (this.rows.length <= 1) return;
    this.rows.removeAt(i);
    this.cdr.markForCheck();
  }

  // ── Teacher search dropdown handler ───────────────────────────────────────
  onTeacherSelected(teacherId: number | null, rowIndex: number): void {
    this.rowAt(rowIndex).get('classTeacherId')?.setValue(teacherId);
  }

  // ── Preset: toggle class / section selection ───────────────────────────────
  toggleClassSelection(classId: number): void {
    this.selectedClassIds.update((set) => {
      const next = new Set(set);
      next.has(classId) ? next.delete(classId) : next.add(classId);
      return next;
    });
  }

  toggleSectionSelection(sectionId: number): void {
    this.selectedSectionIds.update((set) => {
      const next = new Set(set);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  }

  selectAllClasses(): void {
    this.selectedClassIds.set(new Set(this.classes().map((c) => c.id)));
  }

  clearAllClasses(): void {
    this.selectedClassIds.set(new Set());
  }

  selectAllSections(): void {
    this.selectedSectionIds.set(new Set(this.sections().map((s) => s.id)));
  }

  clearAllSections(): void {
    this.selectedSectionIds.set(new Set());
  }

  get presetRowCount(): number {
    return this.selectedClassIds().size * this.selectedSectionIds().size;
  }

  applyPreset(): void {
    const classIds = this.selectedClassIds();
    const sectionIds = this.selectedSectionIds();

    if (classIds.size === 0 || sectionIds.size === 0) {
      this.toast.warning('Select at least one class and one section');
      return;
    }

    const selectedClasses = this.classes().filter((c) => classIds.has(c.id));
    const selectedSections = this.sections().filter((s) => sectionIds.has(s.id));

    const rows = cartesianProduct(selectedClasses, selectedSections);
    this._refillRows(rows);
    this.showPresets.set(false);
    this.toast.success(
      `Generated ${rows.length} combination${rows.length !== 1 ? 's' : ''} — review and submit`
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix validation errors before submitting');
      return;
    }

    const payload = this.rows.getRawValue() as BulkCSRow[];
    this.submitting.set(true);
    this.lastResult.set(null);

    this.academics.bulkCreateClassSections(payload).subscribe({
      next: (res) => {
        this.lastResult.set({ created: res.classSections.length, skipped: res.skipped });

        if (res.classSections.length > 0) {
          this.toast.success(res.message);
        } else {
          this.toast.warning(res.message);
        }

        this.submitting.set(false);

        if (res.skipped.length === 0 && res.classSections.length > 0) {
          setTimeout(() => this.router.navigate(['/school/academics/class-sections']), 1200);
        } else if (res.classSections.length > 0) {
          // Keep only skipped rows in the form
          const skippedSet = new Set(res.skipped);
          const remaining = (this.rows.getRawValue() as BulkCSRow[]).filter((r) => {
            const cls = this.classes().find((c) => c.id === r.classId);
            const sec = this.sections().find((s) => s.id === r.sectionId);
            const display = `${cls?.name ?? ''} – ${sec?.name ?? ''}`;
            return skippedSet.has(display);
          });
          if (remaining.length > 0) {
            this._refillRows(remaining);
          }
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? 'Failed to create class-sections');
        this.submitting.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── UI toggles ─────────────────────────────────────────────────────────────
  togglePresets(): void {
    this.showPresets.update((v) => !v);
    if (this.showPresets()) this.showGuide.set(false);
  }

  toggleGuide(): void {
    this.showGuide.update((v) => !v);
    if (this.showGuide()) this.showPresets.set(false);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  fieldError(ctrl: AbstractControl | null, err: string): boolean {
    return !!(ctrl?.hasError(err) && ctrl?.touched);
  }

  /** Track @for rows by stable uid — fixes Issue 3 (wrong row deleted). */
  trackByUid(_index: number, ctrl: AbstractControl): number {
    return (ctrl as any)._uid as number;
  }

  getClassName(classId: number | null): string {
    if (!classId) return '—';
    return this.classes().find((c) => c.id === classId)?.name ?? '—';
  }

  getSectionName(sectionId: number | null): string {
    if (!sectionId) return '—';
    return this.sections().find((s) => s.id === sectionId)?.name ?? '—';
  }
}
