// class-bulk-edit.ts
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AcademicsService, Class } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-class-bulk-edit',
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
    MatCheckboxModule,
  ],
  templateUrl: './class-bulk-edit.html',
  styleUrl: './class-bulk-edit.scss',
})
export class ClassBulkEdit implements OnInit {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  readonly router = inject(Router);

  // ── State ─────────────────────────────────────────────────────────────────
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  /** Track which rows have been modified since last load */
  dirtyRows = signal<Set<number>>(new Set());

  /** The original data loaded from API (used for change detection) */
  private originalClasses: Class[] = [];

  // ── Form ──────────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({ rows: this.fb.array([]) });

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }

  // ── Computed helpers ──────────────────────────────────────────────────────
  dirtyCount = computed(() => this.dirtyRows().size);
  hasChanges = computed(() => this.dirtyRows().size > 0);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academics
      .getClasses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.originalClasses = res.classes ?? [];
          this.buildForm(this.originalClasses);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load classes');
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private buildForm(classes: Class[]): void {
    const arr = this.rows;
    arr.clear();
    this.dirtyRows.set(new Set());

    classes.forEach((cls) => {
      const group = this.fb.group({
        id: [cls.id],
        name: [cls.name, [Validators.required, Validators.maxLength(50)]],
        level: [cls.level, [Validators.required, Validators.min(0), Validators.max(15)]],
        sort_order: [cls.sort_order, [Validators.required, Validators.min(0), Validators.max(100)]],
      });

      // Mark dirty when any value changes
      group.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        const idx = this.rows.controls.indexOf(group);
        if (idx === -1) return;
        const orig = this.originalClasses[idx];
        const curr = group.getRawValue();

        // FIX: HTML number inputs give back strings; coerce before comparing
        // so a field that hasn't actually changed isn't marked dirty.
        const changed =
          curr.name !== orig?.name ||
          Number(curr.level) !== Number(orig?.level) ||
          Number(curr.sort_order) !== Number(orig?.sort_order);

        this.dirtyRows.update((set) => {
          const next = new Set(set);
          if (changed) next.add(idx);
          else next.delete(idx);
          return next;
        });
      });

      arr.push(group);
    });

    this.cdr.markForCheck();
  }

  // ── Reset single row ──────────────────────────────────────────────────────
  resetRow(index: number): void {
    const orig = this.originalClasses[index];
    if (!orig) return;
    this.rowAt(index).patchValue(orig, { emitEvent: false });
    this.dirtyRows.update((set) => {
      const next = new Set(set);
      next.delete(index);
      return next;
    });
    this.cdr.markForCheck();
  }

  // ── Reset all ─────────────────────────────────────────────────────────────
  resetAll(): void {
    this.buildForm(this.originalClasses);
    this.toast.success('All changes discarded');
  }

  // ── Submit ────────────────────────────────────────────────────────────────
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

    const allRows = this.rows.getRawValue() as (Class & { id: number })[];
    console.log('[BulkEdit] dirtyRows indices:', [...this.dirtyRows()]);
    console.log('[BulkEdit] allRows raw:', allRows);
    const changedRows = allRows
      .filter((_, i) => this.dirtyRows().has(i))
      .map((row) => ({
        id: Number(row.id),
        name: row.name,
        level: Number(row.level),
        sort_order: Number(row.sort_order),
      }));

    console.log('[BulkEdit] changedRows being sent:', JSON.stringify(changedRows));
    console.log('[BulkEdit] payload:', JSON.stringify({ classes: changedRows }));

    this.submitting.set(true);

    this.academics.bulkUpdateClasses(changedRows).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.submitting.set(false);

        if (res.notFound.length > 0) {
          this.toast.warning(`${res.notFound.length} class ID(s) not found on server`);
        }

        // Refresh data to keep originals in sync
        this.loadClasses();
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? 'Failed to update classes');
        this.submitting.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  isRowDirty(index: number): boolean {
    return this.dirtyRows().has(index);
  }

  fieldError(ctrl: AbstractControl | null, err: string): boolean {
    return !!(ctrl?.hasError(err) && ctrl?.touched);
  }

  trackById(_: number, ctrl: AbstractControl): number {
    return ctrl.get('id')?.value;
  }
}
