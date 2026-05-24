// features/school/academics/subjects/subjects-bulk-edit/subjects-bulk-edit.ts
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
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
import { SchoolSubject, SubjectsService } from '../../../../../core/services/subjects.service';
import { ToastService } from '../../../../../core/services/toast.service';

// ── UID counter ───────────────────────────────────────────────────────────────
let _uid = 0;
function nextUid(): number {
  return ++_uid;
}

interface EditRow {
  id: number;
  name: string;
  code: string;
  description: string;
  // snapshot for dirty detection
  _originalName: string;
  _originalCode: string;
  _originalDescription: string;
}

@Component({
  selector: 'app-subjects-bulk-edit',
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
  templateUrl: './subjects-bulk-edit.html',
  styleUrl: './subjects-bulk-edit.scss',
})
export class SubjectsBulkEdit implements OnInit {
  private fb = inject(FormBuilder);
  private subjectsService = inject(SubjectsService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  readonly router = inject(Router);

  // ── State ──────────────────────────────────────────────────────────────────
  loading = signal(true);
  loadError = signal<string | null>(null);
  submitting = signal(false);
  searchTerm = signal('');
  showOnlyDirty = signal(false);

  allSubjects = signal<SchoolSubject[]>([]);

  lastResult = signal<{
    updated: number;
    notFound: number[];
    errors: string[];
  } | null>(null);

  // ── Form ───────────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({ rows: this.fb.array([]) });

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }

  get rowCount(): number {
    return this.rows.length;
  }

  // How many rows differ from original
  get dirtyCount(): number {
    return this.rows.controls.filter((ctrl) => this._isRowDirty(ctrl as FormGroup)).length;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.subjectsService
      .getSubjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.allSubjects.set(res.subjects ?? []);
          this._buildForm(res.subjects ?? []);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadError.set(err?.message ?? 'Failed to load subjects');
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  // ── Form building ──────────────────────────────────────────────────────────
  private _buildForm(subjects: SchoolSubject[]): void {
    while (this.rows.length > 0) {
      this.rows.removeAt(0, { emitEvent: false });
    }

    for (const s of subjects) {
      const fg = this.fb.group({
        id: [s.id],
        name: [s.name, [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
        code: [s.code ?? '', [Validators.maxLength(10)]],
        description: [s.description ?? '', [Validators.maxLength(500)]],
      });

      // Store originals on the FormGroup for dirty checking
      (fg as any)._uid = nextUid();
      (fg as any)._originalName = s.name;
      (fg as any)._originalCode = s.code ?? '';
      (fg as any)._originalDescription = s.description ?? '';

      this.rows.push(fg, { emitEvent: false });
    }

    this.rows.updateValueAndValidity();
  }

  // ── Visibility filter (search + dirty-only toggle) ─────────────────────────
  get visibleIndices(): number[] {
    const term = this.searchTerm().toLowerCase().trim();
    const dirtyOnly = this.showOnlyDirty();

    return this.rows.controls
      .map((ctrl, i) => ({ ctrl, i }))
      .filter(({ ctrl }) => {
        const fg = ctrl as FormGroup;
        const name = (fg.get('name')?.value ?? '').toLowerCase();
        const code = (fg.get('code')?.value ?? '').toLowerCase();

        const matchesSearch = !term || name.includes(term) || code.includes(term);
        const matchesDirty = !dirtyOnly || this._isRowDirty(fg);
        return matchesSearch && matchesDirty;
      })
      .map(({ i }) => i);
  }

  get visibleCount(): number {
    return this.visibleIndices.length;
  }

  private _isRowDirty(fg: FormGroup): boolean {
    const orig = {
      name: (fg as any)._originalName ?? '',
      code: (fg as any)._originalCode ?? '',
      description: (fg as any)._originalDescription ?? '',
    };
    return (
      (fg.get('name')?.value ?? '') !== orig.name ||
      (fg.get('code')?.value ?? '') !== orig.code ||
      (fg.get('description')?.value ?? '') !== orig.description
    );
  }

  isRowDirty(i: number): boolean {
    return this._isRowDirty(this.rowAt(i));
  }

  // ── Reset a single row ─────────────────────────────────────────────────────
  resetRow(i: number): void {
    const fg = this.rowAt(i);
    fg.patchValue({
      name: (fg as any)._originalName,
      code: (fg as any)._originalCode,
      description: (fg as any)._originalDescription,
    });
    fg.markAsPristine();
    this.cdr.markForCheck();
  }

  // ── Reset all rows ─────────────────────────────────────────────────────────
  resetAll(): void {
    for (let i = 0; i < this.rows.length; i++) {
      this.resetRow(i);
    }
    this.toast.info('All changes reset');
    this.cdr.markForCheck();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix validation errors before submitting');
      return;
    }

    if (this.dirtyCount === 0) {
      this.toast.info('No changes to save');
      return;
    }

    // Only send rows that actually changed
    const changed = this.rows.controls
      .filter((ctrl) => this._isRowDirty(ctrl as FormGroup))
      .map((ctrl) => {
        const fg = ctrl as FormGroup;
        return {
          id: fg.get('id')!.value as number,
          name: (fg.get('name')!.value as string).trim(),
          code: (fg.get('code')!.value as string).trim() || null,
          description: (fg.get('description')!.value as string).trim() || null,
        };
      });

    this.submitting.set(true);
    this.lastResult.set(null);

    this.subjectsService
      .bulkUpdateSubjects(changed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.lastResult.set({
            updated: res.subjects.length,
            notFound: res.notFound,
            errors: res.errors,
          });

          if (res.subjects.length > 0) {
            this.toast.success(res.message);

            // Update originals for successfully updated rows
            for (const updated of res.subjects) {
              const ctrl = this.rows.controls.find(
                (c) => (c as FormGroup).get('id')?.value === updated.id
              ) as FormGroup | undefined;
              if (ctrl) {
                (ctrl as any)._originalName = updated.name;
                (ctrl as any)._originalCode = updated.code ?? '';
                (ctrl as any)._originalDescription = updated.description ?? '';
              }
            }
          } else {
            this.toast.warning(res.message);
          }

          this.submitting.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toast.error(err?.error?.error ?? 'Failed to update subjects');
          this.submitting.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  toggleDirtyFilter(): void {
    this.showOnlyDirty.update(v => !v);
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  fieldError(ctrl: AbstractControl | null, err: string): boolean {
    return !!(ctrl?.hasError(err) && ctrl?.touched);
  }

  trackByUid(_index: number, ctrl: AbstractControl): number {
    return (ctrl as any)._uid as number;
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }
}
