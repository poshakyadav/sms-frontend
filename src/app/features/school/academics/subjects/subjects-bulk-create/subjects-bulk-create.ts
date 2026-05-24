// features/school/academics/subjects/subjects-bulk-create/subjects-bulk-create.ts
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  computed,
  afterNextRender,
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
import { MatRippleModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SubjectsService } from '../../../../../core/services/subjects.service';
import { ToastService } from '../../../../../core/services/toast.service';

// ─────────────────────────────────────────────────────────────────────────────
// INDIAN SCHOOL SUBJECT PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export interface SubjectPreset {
  name: string;
  code?: string;
  description?: string;
}

export interface PresetGroup {
  id: string;
  label: string;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'error';
  subjects: SubjectPreset[];
}

export const SUBJECT_PRESET_GROUPS: PresetGroup[] = [
  {
    id: 'primary_core',
    label: 'Primary Core (Class 1–5)',
    icon: 'child_care',
    color: 'success',
    subjects: [
      {
        name: 'Mathematics',
        code: 'MATH',
        description: 'Foundational arithmetic and number sense for primary grades',
      },
      { name: 'English', code: 'ENG', description: 'Reading, writing, and comprehension' },
      { name: 'Hindi', code: 'HIN', description: 'Hindi language and literature' },
      {
        name: 'Environmental Studies',
        code: 'EVS',
        description: 'Science and social studies integrated for primary level',
      },
      { name: 'General Knowledge', code: 'GK', description: 'Current affairs, GK, and awareness' },
      {
        name: 'Computer Science',
        code: 'CS',
        description: 'Basic computer literacy and IT skills',
      },
      {
        name: 'Art & Craft',
        code: 'ART',
        description: 'Creative arts, drawing, and craft activities',
      },
      {
        name: 'Physical Education',
        code: 'PE',
        description: 'Sports, games, and physical fitness',
      },
    ],
  },
  {
    id: 'middle_core',
    label: 'Middle School Core (Class 6–8)',
    icon: 'school',
    color: 'primary',
    subjects: [
      {
        name: 'Mathematics',
        code: 'MATH',
        description: 'Algebra, geometry, and applied mathematics',
      },
      { name: 'Science', code: 'SCI', description: 'Physics, chemistry, and biology integrated' },
      { name: 'Social Science', code: 'SST', description: 'History, geography, and civics' },
      { name: 'English', code: 'ENG', description: 'Language and literature' },
      { name: 'Hindi', code: 'HIN', description: 'Hindi language and literature' },
      { name: 'Sanskrit', code: 'SKT', description: 'Sanskrit language (third language option)' },
      {
        name: 'Computer Applications',
        code: 'CA',
        description: 'IT applications, MS Office, internet basics',
      },
      { name: 'General Knowledge', code: 'GK', description: 'Current affairs and awareness' },
      { name: 'Art Education', code: 'ART', description: 'Visual arts and creative expression' },
      { name: 'Physical Education', code: 'PE', description: 'Sports, games, and yoga' },
    ],
  },
  {
    id: 'secondary_core',
    label: 'Secondary Core (Class 9–10)',
    icon: 'menu_book',
    color: 'warning',
    subjects: [
      {
        name: 'Mathematics',
        code: 'MATH',
        description: 'Standard mathematics — algebra, geometry, statistics',
      },
      { name: 'Science', code: 'SCI', description: 'Integrated physics, chemistry, and biology' },
      {
        name: 'Social Science',
        code: 'SST',
        description: 'History, geography, political science, economics',
      },
      {
        name: 'English Language & Literature',
        code: 'ENG',
        description: 'Core English — language and literature papers',
      },
      { name: 'Hindi', code: 'HIN', description: 'Hindi Course A / Course B' },
      { name: 'Sanskrit', code: 'SKT', description: 'Sanskrit language elective' },
      {
        name: 'Information Technology',
        code: 'IT',
        description: 'IT skills elective (CBSE Code 402)',
      },
      { name: 'Computer Applications', code: 'CA', description: 'Computer applications elective' },
      {
        name: 'Artificial Intelligence',
        code: 'AI',
        description: 'AI fundamentals elective (CBSE Code 417)',
      },
      { name: 'Physical Education', code: 'PE', description: 'Physical education elective' },
    ],
  },
  {
    id: 'senior_common',
    label: 'Senior Secondary Common (Class 11–12)',
    icon: 'auto_stories',
    color: 'info',
    subjects: [
      {
        name: 'English Core',
        code: 'ENGC',
        description: 'Compulsory English for all streams — Class 11–12',
      },
      { name: 'Hindi Core', code: 'HINC', description: 'Compulsory Hindi for all streams' },
      {
        name: 'Physical Education',
        code: 'PE',
        description: 'Physical education — compulsory or elective',
      },
      {
        name: 'Computer Science',
        code: 'CS',
        description: 'Computer science — programming, data structures',
      },
      {
        name: 'Informatics Practices',
        code: 'IP',
        description: 'Informatics practices — databases, web tech',
      },
    ],
  },
  {
    id: 'science_stream',
    label: 'Science Stream (Class 11–12)',
    icon: 'science',
    color: 'error',
    subjects: [
      {
        name: 'Physics',
        code: 'PHY',
        description: 'Mechanics, electricity, optics, modern physics',
      },
      {
        name: 'Chemistry',
        code: 'CHEM',
        description: 'Organic, inorganic, and physical chemistry',
      },
      {
        name: 'Mathematics',
        code: 'MATH',
        description: 'Calculus, vectors, probability, statistics',
      },
      {
        name: 'Biology',
        code: 'BIO',
        description: 'Botany, zoology, ecology — for medical stream',
      },
      {
        name: 'Applied Mathematics',
        code: 'AMATH',
        description: 'Applied maths — alternative to standard maths',
      },
      {
        name: 'Biotechnology',
        code: 'BT',
        description: 'Biotechnology elective for science stream',
      },
      { name: 'Engineering Graphics', code: 'EG', description: 'Engineering drawing and graphics' },
    ],
  },
  {
    id: 'commerce_stream',
    label: 'Commerce Stream (Class 11–12)',
    icon: 'account_balance',
    color: 'warning',
    subjects: [
      {
        name: 'Accountancy',
        code: 'ACC',
        description: 'Financial accounting, company accounts, cash flow',
      },
      {
        name: 'Business Studies',
        code: 'BS',
        description: 'Management, marketing, and business operations',
      },
      { name: 'Economics', code: 'ECO', description: 'Micro and macroeconomics, Indian economy' },
      {
        name: 'Mathematics',
        code: 'MATH',
        description: 'Mathematics elective for commerce stream',
      },
      {
        name: 'Applied Mathematics',
        code: 'AMATH',
        description: 'Applied maths for commerce stream',
      },
      {
        name: 'Entrepreneurship',
        code: 'ENT',
        description: 'Entrepreneurship development and business planning',
      },
    ],
  },
  {
    id: 'humanities_stream',
    label: 'Humanities / Arts Stream (Class 11–12)',
    icon: 'palette',
    color: 'secondary',
    subjects: [
      {
        name: 'History',
        code: 'HIST',
        description: 'Indian and world history — themes and sources',
      },
      {
        name: 'Political Science',
        code: 'POL',
        description: 'Indian constitution, governance, world politics',
      },
      { name: 'Geography', code: 'GEO', description: 'Physical, human, and economic geography' },
      {
        name: 'Sociology',
        code: 'SOC',
        description: 'Society, culture, and social change in India',
      },
      {
        name: 'Psychology',
        code: 'PSY',
        description: 'Behaviour, cognition, and psychological processes',
      },
      { name: 'Economics', code: 'ECO', description: 'Economics for humanities stream' },
      { name: 'Philosophy', code: 'PHIL', description: 'Logic, ethics, and epistemology' },
      {
        name: 'Home Science',
        code: 'HS',
        description: 'Nutrition, family studies, and resource management',
      },
      {
        name: 'Legal Studies',
        code: 'LAW',
        description: 'Introduction to law and legal systems in India',
      },
      {
        name: 'Fine Arts',
        code: 'FA',
        description: 'Painting, sculpture, graphics, and applied arts',
      },
    ],
  },
  {
    id: 'languages',
    label: 'Regional & Foreign Languages',
    icon: 'translate',
    color: 'info',
    subjects: [
      { name: 'Sanskrit', code: 'SKT', description: 'Classical Sanskrit language' },
      { name: 'Urdu', code: 'URD', description: 'Urdu language and literature' },
      { name: 'French', code: 'FRE', description: 'French as a foreign language' },
      { name: 'German', code: 'GER', description: 'German as a foreign language' },
      { name: 'Marathi', code: 'MAR', description: 'Marathi regional language' },
      { name: 'Tamil', code: 'TAM', description: 'Tamil regional language' },
      { name: 'Telugu', code: 'TEL', description: 'Telugu regional language' },
      { name: 'Bengali', code: 'BEN', description: 'Bengali regional language' },
      { name: 'Kannada', code: 'KAN', description: 'Kannada regional language' },
      { name: 'Gujarati', code: 'GUJ', description: 'Gujarati regional language' },
      { name: 'Punjabi', code: 'PUN', description: 'Punjabi regional language' },
      { name: 'Malayalam', code: 'MAL', description: 'Malayalam regional language' },
      { name: 'Odia', code: 'ODI', description: 'Odia regional language' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UID COUNTER
// ─────────────────────────────────────────────────────────────────────────────
let _uid = 0;
function nextUid(): number {
  return ++_uid;
}

@Component({
  selector: 'app-subjects-bulk-create',
  standalone: true,
  // ─────────────────────────────────────────────────────────────────────────
  // WHY Default instead of OnPush for this component:
  //
  // The expand/collapse bug stems from a known Angular limitation: signal-
  // based bindings inside @for loops under ChangeDetectionStrategy.OnPush
  // can miss initial renders when the signal is set in the class field
  // initializer (before the first CD cycle). The @let approach in templates
  // is correct at runtime but does not solve the "first paint" gap.
  //
  // The safest production fix without redesigning the state model is to use
  // Default CD for this component. The preset panel is not performance-
  // critical (it renders once, on demand), so Default CD has zero measurable
  // impact here.
  //
  // If you want to keep OnPush, the fix is to move expandedGroups
  // initialisation inside ngOnInit and call this.cdr.markForCheck() after —
  // both approaches are correct; Default CD is simpler and less fragile.
  // ─────────────────────────────────────────────────────────────────────────
  changeDetection: ChangeDetectionStrategy.Default,
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
    MatCheckboxModule,
  ],
  templateUrl: './subjects-bulk-create.html',
  styleUrl: './subjects-bulk-create.scss',
})
export class SubjectsBulkCreate implements OnInit {
  private fb = inject(FormBuilder);
  private subjectsService = inject(SubjectsService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  readonly router = inject(Router);

  // ── State ──────────────────────────────────────────────────────────────────
  submitting = signal(false);
  showPresets = signal(false);
  showGuide = signal(false);
  lastResult = signal<{ created: number; skipped: string[]; errors: string[] } | null>(null);

  // ── Preset selection ───────────────────────────────────────────────────────
  readonly presetGroups = SUBJECT_PRESET_GROUPS;
  selectedPresetSubjects = signal<Set<string>>(new Set());

  /**
   * Groups that are expanded in the preset panel.
   *
   * FIX: Initialised as an empty Set here. The full expansion is applied in
   * ngOnInit so it happens inside the first Angular CD cycle, guaranteeing
   * that the DOM picks up the --open class on first render.
   *
   * Setting this in the class field initializer (before ngOnInit) causes a
   * race where the signal value is ready but Angular's OnPush scheduler has
   * not yet run a CD pass over the template, leaving chips invisible.
   */
  expandedGroups = signal<Set<string>>(new Set());

  /** Search query for filtering subjects inside the preset panel */
  presetSearchQuery = signal<string>('');

  previewCount = computed(() => this.selectedPresetSubjects().size);

  filteredPresetGroups = computed(() => {
    const q = this.presetSearchQuery().trim().toLowerCase();
    if (!q) return this.presetGroups;
    return this.presetGroups
      .map((group) => ({
        ...group,
        subjects: group.subjects.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.code?.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.subjects.length > 0);
  });

  filteredSubjectCount = computed(() =>
    this.filteredPresetGroups().reduce((acc, g) => acc + g.subjects.length, 0)
  );

  /**
   * Reactive map of group selection state.
   *
   * This computed() replaces individual isGroupFullySelected() / isGroupPartiallySelected()
   * methods. Template reads this single signal, so any change to selectedPresetSubjects
   * invalidates and re-renders correctly under OnPush.
   */
  groupSelectionState = computed(() => {
    const sel = this.selectedPresetSubjects();
    const map = new Map<
      string,
      { fullySelected: boolean; partiallySelected: boolean; selectedCount: number }
    >();
    for (const group of this.presetGroups) {
      const count = group.subjects.filter((s) => sel.has(s.name)).length;
      map.set(group.id, {
        fullySelected: group.subjects.length > 0 && count === group.subjects.length,
        partiallySelected: count > 0 && count < group.subjects.length,
        selectedCount: count,
      });
    }
    return map;
  });

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

  getUid(ctrl: AbstractControl): number {
    return (ctrl as any)._uid as number;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this._refillRows([{}]);

    // FIX: Initialise expanded groups here (inside the first CD cycle) rather
    // than in the class field, so Angular's scheduler has already bootstrapped
    // the component view before the signal value is consumed by the template.
    this.expandedGroups.set(new Set(SUBJECT_PRESET_GROUPS.map((g) => g.id)));
  }

  // ── Row builders ───────────────────────────────────────────────────────────
  private _emptyRow(data?: Partial<SubjectPreset>): FormGroup {
    const fg = this.fb.group({
      name: [
        data?.name ?? '',
        [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
      ],
      code: [data?.code ?? '', [Validators.maxLength(10)]],
      description: [data?.description ?? '', [Validators.maxLength(500)]],
    });
    (fg as any)._uid = nextUid();
    return fg;
  }

  private _refillRows(rows: Partial<SubjectPreset>[]): void {
    while (this.rows.length > 0) {
      this.rows.removeAt(0, { emitEvent: false });
    }
    for (const r of rows) {
      this.rows.push(this._emptyRow(r), { emitEvent: false });
    }
    this.rows.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  addRow(): void {
    this.rows.push(this._emptyRow());
    this.cdr.markForCheck();
  }

  removeRow(i: number): void {
    if (this.rows.length <= 1) return;
    this.rows.removeAt(i);
    this.cdr.markForCheck();
  }

  // ── Group expand / collapse ────────────────────────────────────────────────
  toggleGroup(groupId: string): void {
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  expandAllGroups(): void {
    this.expandedGroups.set(new Set(this.presetGroups.map((g) => g.id)));
  }

  collapseAllGroups(): void {
    this.expandedGroups.set(new Set());
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  onPresetSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.presetSearchQuery.set(query);
    if (query.trim()) {
      this.expandAllGroups();
    }
  }

  clearSearch(): void {
    this.presetSearchQuery.set('');
  }

  // ── Preset logic ───────────────────────────────────────────────────────────
  isSubjectSelected(name: string): boolean {
    return this.selectedPresetSubjects().has(name);
  }

  togglePresetSubject(subject: SubjectPreset): void {
    this.selectedPresetSubjects.update((set) => {
      const s = new Set(set);
      if (s.has(subject.name)) {
        s.delete(subject.name);
      } else {
        s.add(subject.name);
      }
      return s;
    });
  }

  selectAllInGroup(group: PresetGroup): void {
    this.selectedPresetSubjects.update((set) => {
      const s = new Set(set);
      for (const sub of group.subjects) s.add(sub.name);
      return s;
    });
  }

  clearAllInGroup(group: PresetGroup): void {
    this.selectedPresetSubjects.update((set) => {
      const s = new Set(set);
      for (const sub of group.subjects) s.delete(sub.name);
      return s;
    });
  }

  selectAllSubjects(): void {
    const all = new Set<string>();
    for (const group of this.presetGroups) {
      for (const s of group.subjects) all.add(s.name);
    }
    this.selectedPresetSubjects.set(all);
  }

  clearAllSubjects(): void {
    this.selectedPresetSubjects.set(new Set());
  }

  applyPreset(): void {
    const selected = this.selectedPresetSubjects();
    if (selected.size === 0) {
      this.toast.warning('Select at least one subject');
      return;
    }
    const presetMap = new Map<string, SubjectPreset>();
    for (const group of this.presetGroups) {
      for (const s of group.subjects) {
        if (!presetMap.has(s.name)) presetMap.set(s.name, s);
      }
    }
    const rows: SubjectPreset[] = [];
    for (const name of selected) {
      rows.push(presetMap.get(name) ?? { name });
    }
    this._refillRows(rows);
    this.showPresets.set(false);
    this.toast.success(
      `Generated ${rows.length} subject${rows.length !== 1 ? 's' : ''} — review and submit`
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fix validation errors before submitting');
      return;
    }
    const raw = this.rows.getRawValue() as Array<{
      name: string;
      code: string;
      description: string;
    }>;
    const payload = raw.map((r) => ({
      name: r.name.trim(),
      code: r.code?.trim() || undefined,
      description: r.description?.trim() || undefined,
    }));
    this.submitting.set(true);
    this.lastResult.set(null);
    this.subjectsService
      .bulkCreateSubjects(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.lastResult.set({
            created: res.subjects.length,
            skipped: res.skipped,
            errors: res.errors,
          });
          if (res.subjects.length > 0) {
            this.toast.success(res.message);
          } else {
            this.toast.warning(res.message);
          }
          this.submitting.set(false);
          if (res.skipped.length === 0 && res.errors.length === 0 && res.subjects.length > 0) {
            setTimeout(() => this.router.navigate(['/school/academics/subjects/list']), 1400);
          } else if (res.subjects.length > 0 && res.skipped.length > 0) {
            const createdNames = new Set(res.subjects.map((s) => s.name.toLowerCase()));
            const remaining = (this.rows.getRawValue() as any[]).filter(
              (r) => !createdNames.has(r.name.trim().toLowerCase())
            );
            if (remaining.length > 0) this._refillRows(remaining);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toast.error(err?.error?.error ?? 'Failed to create subjects');
          this.submitting.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  togglePresets(): void {
    this.showPresets.update((v) => !v);
    if (this.showPresets()) {
      this.showGuide.set(false);
      this.presetSearchQuery.set('');
      // Re-expand all groups each time the panel opens
      this.expandedGroups.set(new Set(this.presetGroups.map((g) => g.id)));
    }
  }

  toggleGuide(): void {
    this.showGuide.update((v) => !v);
    if (this.showGuide()) this.showPresets.set(false);
  }

  fieldError(ctrl: AbstractControl | null, err: string): boolean {
    return !!(ctrl?.hasError(err) && ctrl?.touched);
  }

  trackByUid(_index: number, ctrl: AbstractControl): number {
    return (ctrl as any)._uid as number;
  }

  getColorClass(color: PresetGroup['color']): string {
    const map: Record<string, string> = {
      primary: 'preset-group--primary',
      success: 'preset-group--success',
      warning: 'preset-group--warning',
      info: 'preset-group--info',
      secondary: 'preset-group--secondary',
      error: 'preset-group--error',
    };
    return map[color] ?? 'preset-group--primary';
  }

  /**
   * trackBy for preset groups — prevents Angular from recreating DOM nodes
   * when filteredPresetGroups() recomputes during search.
   */
  trackByGroupId(_index: number, group: PresetGroup): string {
    return group.id;
  }

  /**
   * trackBy for subject chips — stable identity prevents flicker on selection.
   */
  trackBySubjectName(_index: number, subject: SubjectPreset): string {
    return subject.name;
  }
}
