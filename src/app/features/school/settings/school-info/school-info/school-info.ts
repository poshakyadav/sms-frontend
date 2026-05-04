// school-info.ts
// …/features/school/settings/school-info/school-info/school-info.ts
// ─────────────────────────────────────────────────────────────────────────────
// School Configuration Page — production-grade, fully themed
// Route: /school/settings/info  (permission: settings.manage)
// ─────────────────────────────────────────────────────────────────────────────

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';
import { ToastService } from '../../../../../core/services/toast.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchoolInfo {
  id: number;
  name: string;
  shortName: string | null;
  uniqueCode: string;
  addressLineOne: string;
  addressLineTwo: string;
  phone: string;
  alternatePhone: string;
  email: string;
  website: string;
  logoUrl: string;
  tagline: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Custom Validators ─────────────────────────────────────────────────────────

function shortNameValidator(control: AbstractControl): ValidationErrors | null {
  const val: string = control.value ?? '';
  if (!val) return null; // optional field
  if (val.length > 8) return { maxlength: { requiredLength: 8, actualLength: val.length } };
  if (!/^[A-Za-z0-9 \-\.]+$/.test(val)) return { pattern: true };
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-school-info',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    RouterModule,
  ],
  templateUrl: './school-info.html',
  styleUrl: './school-info.scss',
})
export class SchoolInfoComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  // ── State signals ────────────────────────────────────────────────────────
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  schoolInfo = signal<SchoolInfo | null>(null);
  logoPreviewError = signal(false);
  activeSection = signal<'basic' | 'contact' | 'branding'>('basic');

  // ── Computed ─────────────────────────────────────────────────────────────
  shortNamePreview = computed(() => {
    const val = this.form?.get('shortName')?.value ?? '';
    return (
      val.trim().toUpperCase().slice(0, 8) ||
      this.schoolInfo()?.shortName?.toUpperCase() ||
      'SCHOOL'
    );
  });

  logoPreviewUrl = computed(() => {
    const val = this.form?.get('logoUrl')?.value ?? '';
    return val && !this.logoPreviewError() ? val : null;
  });

  // ── Form ─────────────────────────────────────────────────────────────────
  form!: FormGroup;

  ngOnInit(): void {
    this.buildForm();
    this.loadSchoolInfo();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      // Basic info
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      shortName: ['', [shortNameValidator]],
      tagline: ['', [Validators.maxLength(300)]],
      logoUrl: ['', []],

      // Contact
      phone: ['', [Validators.maxLength(20)]],
      alternatePhone: ['', [Validators.maxLength(20)]],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      website: ['', [Validators.maxLength(255)]],

      // Address
      addressLineOne: ['', [Validators.maxLength(255)]],
      addressLineTwo: ['', [Validators.maxLength(255)]],
    });
  }

  loadSchoolInfo(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<{ success: boolean; school: SchoolInfo }>('school/info').subscribe({
      next: (res) => {
        if (res.success && res.school) {
          this.schoolInfo.set(res.school);
          this.patchForm(res.school);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load school information');
        this.loading.set(false);
      },
    });
  }

  private patchForm(info: SchoolInfo): void {
    this.form.patchValue({
      name: info.name ?? '',
      shortName: info.shortName ?? '',
      tagline: info.tagline ?? '',
      logoUrl: info.logoUrl ?? '',
      phone: info.phone ?? '',
      alternatePhone: info.alternatePhone ?? '',
      email: info.email ?? '',
      website: info.website ?? '',
      addressLineOne: info.addressLineOne ?? '',
      addressLineTwo: info.addressLineTwo ?? '',
    });
    this.form.markAsPristine();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  setSection(section: 'basic' | 'contact' | 'branding'): void {
    this.activeSection.set(section);
  }

  onLogoUrlChange(): void {
    this.logoPreviewError.set(false);
  }

  onLogoPreviewError(): void {
    this.logoPreviewError.set(true);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;

    // Build only changed fields
    const payload: Record<string, any> = {};
    const controls = this.form.controls;

    Object.keys(controls).forEach((key) => {
      if (controls[key].dirty) {
        payload[key] = controls[key].value ?? '';
      }
    });

    if (Object.keys(payload).length === 0) {
      this.toast.info?.('No changes to save') ?? this.toast.error('No changes to save');
      return;
    }

    this.saving.set(true);

    this.api.put<{ success: boolean; message: string }>('school/info', payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.success('School information updated successfully!');
          // Refresh local data
          this.loadSchoolInfo();
          // Update localStorage schoolInfo for header
          this.updateLocalSchoolInfo(payload);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error || 'Failed to update school information');
      },
    });
  }

  private updateLocalSchoolInfo(changes: Record<string, any>): void {
    try {
      const raw = localStorage.getItem('schoolInfo');
      if (!raw) return;
      const current = JSON.parse(raw);
      const updated = { ...current, ...changes };
      localStorage.setItem('schoolInfo', JSON.stringify(updated));
    } catch {
      // non-critical
    }
  }

  onReset(): void {
    const info = this.schoolInfo();
    if (info) this.patchForm(info);
  }

  // ── Field helpers ─────────────────────────────────────────────────────────

  getError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;
    if (ctrl.errors['required']) return 'This field is required';
    if (ctrl.errors['minlength'])
      return `Minimum ${ctrl.errors['minlength'].requiredLength} characters`;
    if (ctrl.errors['maxlength'])
      return `Maximum ${ctrl.errors['maxlength'].requiredLength} characters`;
    if (ctrl.errors['email']) return 'Enter a valid email address';
    if (ctrl.errors['pattern']) return 'Only letters, numbers, spaces, hyphens and dots allowed';
    return 'Invalid value';
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.invalid);
  }

  shortNameLength = computed(() => {
    return (this.form?.get('shortName')?.value ?? '').length;
  });
}
