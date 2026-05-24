// class-bulk-create.ts
import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';

// ── Template class row ────────────────────────────────────────────────────────
interface ClassTemplate {
  name: string;
  level: number;
  sort_order: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INDIAN SCHOOL PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const PRE_PRIMARY: ClassTemplate[] = [
  { name: 'Nursery', level: 0, sort_order: 1 },
  { name: 'LKG', level: 0, sort_order: 2 },
  { name: 'UKG', level: 0, sort_order: 3 },
];

const PRIMARY_1_TO_5 = (startOrder = 1): ClassTemplate[] =>
  [1, 2, 3, 4, 5].map((n, i) => ({
    name: `Class ${n}`,
    level: n,
    sort_order: startOrder + i,
  }));

const MIDDLE_6_TO_8 = (startOrder = 1): ClassTemplate[] =>
  [6, 7, 8].map((n, i) => ({
    name: `Class ${n}`,
    level: n,
    sort_order: startOrder + i,
  }));

const SECONDARY_9_TO_10 = (startOrder = 1): ClassTemplate[] =>
  [9, 10].map((n, i) => ({
    name: `Class ${n}`,
    level: n,
    sort_order: startOrder + i,
  }));

const HIGHER_SECONDARY_11_TO_12 = (startOrder = 1): ClassTemplate[] =>
  [11, 12].map((n, i) => ({
    name: `Class ${n}`,
    level: 13 + i,
    sort_order: startOrder + i,
  }));

const nurseryTo12 = (): ClassTemplate[] => [
  ...PRE_PRIMARY,
  ...PRIMARY_1_TO_5(4),
  ...MIDDLE_6_TO_8(9),
  ...SECONDARY_9_TO_10(12),
  ...HIGHER_SECONDARY_11_TO_12(14),
];

const class1To12 = (): ClassTemplate[] => [
  ...PRIMARY_1_TO_5(1),
  ...MIDDLE_6_TO_8(6),
  ...SECONDARY_9_TO_10(9),
  ...HIGHER_SECONDARY_11_TO_12(11),
];

const PRESET_TEMPLATES: {
  label: string;
  description: string;
  stage: string;
  classes: ClassTemplate[];
}[] = [
  {
    label: 'Nursery → Class 12',
    description: 'Full school: Pre-Primary through Higher Secondary (15 classes)',
    stage: 'Complete',
    classes: nurseryTo12(),
  },
  {
    label: 'Class 1 → Class 12',
    description: 'Primary through Higher Secondary, no Pre-Primary (12 classes)',
    stage: 'Complete',
    classes: class1To12(),
  },
  {
    label: 'Nursery → Class 5',
    description: 'Pre-Primary + Primary stage only (8 classes)',
    stage: 'Primary',
    classes: [...PRE_PRIMARY, ...PRIMARY_1_TO_5(4)],
  },
  {
    label: 'Class 1 → Class 5',
    description: 'Primary stage only (5 classes)',
    stage: 'Primary',
    classes: PRIMARY_1_TO_5(),
  },
  {
    label: 'Nursery → Class 8',
    description: 'Pre-Primary + Primary + Middle stage (11 classes)',
    stage: 'Middle',
    classes: [...PRE_PRIMARY, ...PRIMARY_1_TO_5(4), ...MIDDLE_6_TO_8(9)],
  },
  {
    label: 'Class 1 → Class 8',
    description: 'Primary + Middle stage (8 classes)',
    stage: 'Middle',
    classes: [...PRIMARY_1_TO_5(), ...MIDDLE_6_TO_8(6)],
  },
  {
    label: 'Nursery → Class 10',
    description: 'Pre-Primary through Secondary — up to Board Exams (13 classes)',
    stage: 'Secondary',
    classes: [...PRE_PRIMARY, ...PRIMARY_1_TO_5(4), ...MIDDLE_6_TO_8(9), ...SECONDARY_9_TO_10(12)],
  },
  {
    label: 'Class 1 → Class 10',
    description: 'Primary through Secondary — up to Board Exams (10 classes)',
    stage: 'Secondary',
    classes: [...PRIMARY_1_TO_5(), ...MIDDLE_6_TO_8(6), ...SECONDARY_9_TO_10(9)],
  },
];

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-class-bulk-create',
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
    MatExpansionModule,
  ],
  templateUrl: './class-bulk-create.html',
  styleUrl: './class-bulk-create.scss',
})
export class ClassBulkCreate {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  readonly router = inject(Router);

  // ── Signals ───────────────────────────────────────────────────────────────
  submitting = signal(false);
  showPresets = signal(false);
  showGuide = signal(false);
  lastResult = signal<{ created: number; skipped: string[] } | null>(null);

  readonly presets = PRESET_TEMPLATES;

  readonly stageColor: Record<string, string> = {
    Complete: 'primary',
    Primary: 'success',
    Middle: 'warning',
    Secondary: 'info',
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  // NOTE: form is a plain class property (not readonly) so _rebuildFromValues
  // can replace the entire FormGroup instance. Replacing the reference is the
  // only reliable way to force Angular's [formGroup] directive to fully
  // re-bind all child controls in OnPush mode.
  form: FormGroup = this.fb.group({
    rows: this.fb.array([this.buildRow(undefined, 1)]),
  });

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }

  rowCount = computed(() => this.rows.length);

  // ── Private row builder ───────────────────────────────────────────────────
  private buildRow(data?: Partial<ClassTemplate>, sortOrder?: number): FormGroup {
    return this.fb.group({
      name: [data?.name ?? '', [Validators.required, Validators.maxLength(50)]],
      level: [data?.level ?? 1, [Validators.required, Validators.min(0), Validators.max(15)]],
      sort_order: [
        sortOrder ?? data?.sort_order ?? 1,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
    });
  }

  // ── Row management ────────────────────────────────────────────────────────
  addRow(): void {
    const nextOrder = this.rows.length + 1;
    this.rows.push(this.buildRow({ name: '', level: 1, sort_order: nextOrder }));
    this.cdr.markForCheck();
  }

  removeRow(index: number): void {
    if (this.rows.length <= 1) return;
    this.rows.removeAt(index);
    this.cdr.markForCheck();
  }

  // ── Rebuild helper ────────────────────────────────────────────────────────
  // ROOT FIX: Replace the entire FormGroup instance so Angular's [formGroup]
  // binding sees a new object reference and fully tears down + re-binds every
  // child formControlName — including row 0.
  //
  // Why mutating the existing FormArray doesn't work:
  //   clear() + push() changes the array contents but the FormGroup reference
  //   on [formGroup]="form" stays the same. Angular's OnPush + formArrayName
  //   directive caches the control lookup; with track-by-index the @for loop
  //   reuses the existing DOM node at index 0 and never re-queries its bound
  //   FormControl, so the input keeps displaying its previous (empty) value.
  //
  // Replacing `this.form` gives Angular a brand-new object on [formGroup],
  // which forces the ReactiveFormsModule directives to re-initialise all
  // bindings from scratch. Combined with `track row` in the template (which
  // tracks by object identity, not index), every row gets a fresh DOM node.
  private _rebuildFromValues(values: ClassTemplate[]): void {
    this.form = this.fb.group({
      rows: this.fb.array(values.map((v) => this.buildRow(v, v.sort_order))),
    });
    this.cdr.markForCheck();
  }

  resequence(): void {
    const values = this.rows.getRawValue() as ClassTemplate[];
    const resequenced = values.map((v, i) => ({ ...v, sort_order: i + 1 }));
    this._rebuildFromValues(resequenced);
    this.toast.success('Sort orders updated to match row positions');
  }

  // ── Presets ───────────────────────────────────────────────────────────────
  applyPreset(preset: (typeof PRESET_TEMPLATES)[0]): void {
    this._rebuildFromValues(preset.classes);
    this.showPresets.set(false);
    this.toast.success(`Loaded "${preset.label}" — ${preset.classes.length} classes ready`);
  }

  togglePresets(): void {
    this.showPresets.update((v) => !v);
    if (this.showPresets()) this.showGuide.set(false);
  }

  toggleGuide(): void {
    this.showGuide.update((v) => !v);
    if (this.showGuide()) this.showPresets.set(false);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix validation errors before submitting');
      return;
    }

    const payload = this.rows.getRawValue() as ClassTemplate[];
    this.submitting.set(true);
    this.lastResult.set(null);

    this.academics.bulkCreateClasses(payload).subscribe({
      next: (res) => {
        this.lastResult.set({ created: res.classes.length, skipped: res.skipped });

        if (res.classes.length > 0) {
          this.toast.success(res.message);
        } else {
          this.toast.warning(res.message);
        }

        this.submitting.set(false);

        if (res.skipped.length === 0 && res.classes.length > 0) {
          setTimeout(() => this.router.navigate(['/school/academics/classes']), 1200);
        } else if (res.classes.length > 0) {
          const skippedSet = new Set(res.skipped.map((s) => s.toLowerCase()));
          const remaining = (this.rows.getRawValue() as ClassTemplate[]).filter((r) =>
            skippedSet.has(r.name.toLowerCase())
          );
          this._rebuildFromValues(remaining);
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? 'Failed to create classes');
        this.submitting.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fieldError(ctrl: AbstractControl | null, err: string): boolean {
    return !!(ctrl?.hasError(err) && ctrl?.touched);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
