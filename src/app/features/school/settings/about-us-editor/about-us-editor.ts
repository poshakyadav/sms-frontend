// src/app/features/school/settings/about-us-editor/about-us-editor.ts
// ─────────────────────────────────────────────────────────────────────────────
// About Us Editor — settings.manage permission only
// Route: /school/settings/about-us
// ─────────────────────────────────────────────────────────────────────────────

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AboutUsData, AboutUsService } from '../../../../core/services/about-us.service';
import { ToastService } from '../../../../core/services/toast.service';

type Section =
  | 'overview'
  | 'identity'
  | 'principal'
  | 'values'
  | 'achievements'
  | 'facilities'
  | 'gallery'
  | 'social';

@Component({
  selector: 'app-about-us-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
  ],
  templateUrl: './about-us-editor.html',
  styleUrl: './about-us-editor.scss',
})
export class AboutUsEditor implements OnInit {
  private svc = inject(AboutUsService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  // ── State ─────────────────────────────────────────────────────────────────
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  activeSection = signal<Section>('overview');
  originalData = signal<AboutUsData | null>(null);

  // ── Nav sections ──────────────────────────────────────────────────────────
  readonly sections: { key: Section; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'info_outline' },
    { key: 'identity', label: 'Identity', icon: 'history_edu' },
    { key: 'principal', label: 'Principal', icon: 'person' },
    { key: 'values', label: 'Core Values', icon: 'diamond' },
    { key: 'achievements', label: 'Milestones', icon: 'emoji_events' },
    { key: 'facilities', label: 'Facilities', icon: 'apartment' },
    { key: 'gallery', label: 'Gallery', icon: 'photo_library' },
    { key: 'social', label: 'Social', icon: 'share' },
  ];

  // ── Quick-add facility options ────────────────────────────────────────────
  readonly quickFacilities = [
    'Library',
    'Science Lab',
    'Computer Lab',
    'Swimming Pool',
    'Auditorium',
    'Sports Ground',
    'Cafeteria',
    'Music Room',
    'Art Studio',
    'Smart Classrooms',
    'Gymnasium',
    'Infirmary',
  ];

  // ── Form ─────────────────────────────────────────────────────────────────
  form!: FormGroup;

  // ── FormArray typed accessors (pure getters — no signals, Angular-safe) ──

  get coreValueControls(): FormGroup[] {
    return (this.form.get('coreValues') as FormArray).controls as FormGroup[];
  }

  get achievementControls(): FormGroup[] {
    return (this.form.get('achievements') as FormArray).controls as FormGroup[];
  }

  get facilityControls(): AbstractControl[] {
    return (this.form.get('facilities') as FormArray).controls;
  }

  get galleryControls(): AbstractControl[] {
    return (this.form.get('galleryUrls') as FormArray).controls;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForm();
    this.load();
  }

  // ── Form construction ─────────────────────────────────────────────────────
  private buildForm(): void {
    this.form = this.fb.group({
      // Overview
      description: ['', [Validators.maxLength(5000)]],
      mission: ['', [Validators.maxLength(2000)]],
      vision: ['', [Validators.maxLength(2000)]],

      // Identity
      foundedYear: [null as number | null, [Validators.min(1800), Validators.max(2100)]],
      foundedBy: ['', [Validators.maxLength(200)]],
      history: ['', [Validators.maxLength(10000)]],
      affiliationBoard: ['', [Validators.maxLength(100)]],
      affiliationNumber: ['', [Validators.maxLength(100)]],
      accreditation: ['', [Validators.maxLength(200)]],

      // Stats
      totalStudents: [null as number | null, [Validators.min(0)]],
      totalTeachers: [null as number | null, [Validators.min(0)]],
      totalStaff: [null as number | null, [Validators.min(0)]],
      campusAreaAcres: ['', [Validators.maxLength(20)]],

      // Principal
      principalName: ['', [Validators.maxLength(200)]],
      principalMessage: ['', [Validators.maxLength(3000)]],
      principalAvatarUrl: [''],

      // Social
      facebookUrl: [''],
      twitterUrl: [''],
      instagramUrl: [''],
      youtubeUrl: [''],
      linkedinUrl: [''],

      // Dynamic arrays
      coreValues: this.fb.array([]),
      achievements: this.fb.array([]),
      facilities: this.fb.array([]),
      galleryUrls: this.fb.array([]),
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.svc.getAboutUs().subscribe({
      next: (res) => {
        this.originalData.set(res.aboutUs);
        this.patchForm(res.aboutUs);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load About Us data.');
        this.loading.set(false);
      },
    });
  }

  private patchForm(d: AboutUsData): void {
    // Scalar fields
    this.form.patchValue({
      description: d.description ?? '',
      mission: d.mission ?? '',
      vision: d.vision ?? '',
      foundedYear: d.foundedYear ?? null,
      foundedBy: d.foundedBy ?? '',
      history: d.history ?? '',
      affiliationBoard: d.affiliationBoard ?? '',
      affiliationNumber: d.affiliationNumber ?? '',
      accreditation: d.accreditation ?? '',
      totalStudents: d.totalStudents ?? null,
      totalTeachers: d.totalTeachers ?? null,
      totalStaff: d.totalStaff ?? null,
      campusAreaAcres: d.campusAreaAcres ?? '',
      principalName: d.principalName ?? '',
      principalMessage: d.principalMessage ?? '',
      principalAvatarUrl: d.principalAvatarUrl ?? '',
      facebookUrl: d.facebookUrl ?? '',
      twitterUrl: d.twitterUrl ?? '',
      instagramUrl: d.instagramUrl ?? '',
      youtubeUrl: d.youtubeUrl ?? '',
      linkedinUrl: d.linkedinUrl ?? '',
    });

    // Rebuild dynamic arrays
    this.rebuildArray('coreValues', d.coreValues ?? [], (v) =>
      this.fb.group({ title: [v.title, Validators.required], description: [v.description] })
    );
    this.rebuildArray('achievements', d.achievements ?? [], (a) =>
      this.fb.group({
        year: [a.year ?? null],
        title: [a.title, Validators.required],
        description: [a.description],
      })
    );
    this.rebuildArray('facilities', d.facilities ?? [], (f) =>
      this.fb.control(f, Validators.required)
    );
    this.rebuildArray('galleryUrls', d.galleryUrls ?? [], (url) => this.fb.control(url));

    this.form.markAsPristine();
  }

  private rebuildArray<T>(key: string, items: T[], factory: (item: T) => AbstractControl): void {
    const arr = this.form.get(key) as FormArray;
    arr.clear({ emitEvent: false });
    items.forEach((item) => arr.push(factory(item), { emitEvent: false }));
  }

  // ── Array mutation helpers ────────────────────────────────────────────────
  addCoreValue(): void {
    (this.form.get('coreValues') as FormArray).push(
      this.fb.group({ title: ['', Validators.required], description: [''] })
    );
    this.form.markAsDirty();
  }
  removeCoreValue(i: number): void {
    (this.form.get('coreValues') as FormArray).removeAt(i);
    this.form.markAsDirty();
  }

  addAchievement(): void {
    (this.form.get('achievements') as FormArray).push(
      this.fb.group({ year: [null], title: ['', Validators.required], description: [''] })
    );
    this.form.markAsDirty();
  }
  removeAchievement(i: number): void {
    (this.form.get('achievements') as FormArray).removeAt(i);
    this.form.markAsDirty();
  }

  addFacility(name = ''): void {
    const arr = this.form.get('facilities') as FormArray;
    if (arr.length >= 50) return;
    arr.push(this.fb.control(name, Validators.required));
    this.form.markAsDirty();
  }
  removeFacility(i: number): void {
    (this.form.get('facilities') as FormArray).removeAt(i);
    this.form.markAsDirty();
  }

  addGalleryUrl(): void {
    const arr = this.form.get('galleryUrls') as FormArray;
    if (arr.length >= 20) return;
    arr.push(this.fb.control(''));
    this.form.markAsDirty();
  }
  removeGalleryUrl(i: number): void {
    (this.form.get('galleryUrls') as FormArray).removeAt(i);
    this.form.markAsDirty();
  }

  // ── Section navigation ────────────────────────────────────────────────────
  setSection(s: Section): void {
    this.activeSection.set(s);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  onSave(): void {
    if (this.saving() || this.form.invalid) return;

    const raw = this.form.getRawValue();

    // Helper: send empty string for cleared URL fields (not null)
    const cleanUrl = (v: string): string => v?.trim() ?? '';

    const payload = {
      description: raw.description,
      mission: raw.mission,
      vision: raw.vision,
      foundedYear: raw.foundedYear ? Number(raw.foundedYear) : null,
      foundedBy: raw.foundedBy,
      history: raw.history,
      affiliationBoard: raw.affiliationBoard,
      affiliationNumber: raw.affiliationNumber,
      accreditation: raw.accreditation,
      totalStudents: raw.totalStudents ? Number(raw.totalStudents) : null,
      totalTeachers: raw.totalTeachers ? Number(raw.totalTeachers) : null,
      totalStaff: raw.totalStaff ? Number(raw.totalStaff) : null,
      campusAreaAcres: raw.campusAreaAcres,
      principalName: raw.principalName,
      principalMessage: raw.principalMessage,
      principalAvatarUrl: cleanUrl(raw.principalAvatarUrl),
      facebookUrl: cleanUrl(raw.facebookUrl),
      twitterUrl: cleanUrl(raw.twitterUrl),
      instagramUrl: cleanUrl(raw.instagramUrl),
      youtubeUrl: cleanUrl(raw.youtubeUrl),
      linkedinUrl: cleanUrl(raw.linkedinUrl),
      // Strip empty/blank entries from arrays
      coreValues: (raw.coreValues as any[]).filter((v) => v?.title?.trim()),
      achievements: (raw.achievements as any[]).filter((a) => a?.title?.trim()),
      facilities: (raw.facilities as string[]).filter((f) => f?.trim()),
      galleryUrls: (raw.galleryUrls as string[]).filter((u) => u?.trim()),
    };

    this.saving.set(true);

    this.svc.updateAboutUs(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success('About Us saved successfully!');
        this.originalData.set(res.aboutUs);
        this.form.markAsPristine();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error || 'Failed to save About Us. Please try again.');
      },
    });
  }

  // Reset to last saved state
  onReset(): void {
    const d = this.originalData();
    if (d) this.patchForm(d);
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  /** Returns validation error message for a scalar field, empty otherwise */
  getError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;
    if (ctrl.errors['required']) return 'This field is required';
    if (ctrl.errors['maxlength'])
      return `Maximum ${ctrl.errors['maxlength'].requiredLength} characters`;
    if (ctrl.errors['min']) return `Minimum value is ${ctrl.errors['min'].min}`;
    if (ctrl.errors['max']) return `Maximum value is ${ctrl.errors['max'].max}`;
    return 'Invalid value';
  }

  /** Character count hint: "123 / 5000" */
  charCount(field: string, max: number): string {
    const len = (this.form.get(field)?.value ?? '').length;
    return `${len} / ${max}`;
  }

  /** Returns index of an AbstractControl in facilityControls (for formControlName binding) */
  trackByIndex(index: number): number {
    return index;
  }
}
