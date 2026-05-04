// my-profile.ts — Universal profile for ALL roles
// Edit Profile tab is READ-ONLY for users without `users.edit` permission.
// Password & Email tabs remain self-service for every authenticated user.

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import {
  ProfileService,
  UpdateProfilePayload,
  UserProfile,
} from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-my-profile',
  standalone: true,
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
    MatTabsModule,
  ],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.scss',
})
export class MyProfile implements OnInit {
  private profileService = inject(ProfileService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  // ── State ─────────────────────────────────────────────────────────────────
  profile = signal<UserProfile | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  /**
   * Whether the current user may edit profile fields (name, address, etc.).
   * Set from the `canEditProfile` flag returned by GET /school/profile/me.
   * The backend derives this from the caller's JWT permissions (`users.edit` or `*`).
   *
   * Students, parents, and lower-staff get FALSE → read-only view.
   * School owners and users with `users.edit` get TRUE → full edit form.
   */
  canEditProfile = signal(false);

  // Form saving states
  savingProfile = signal(false);
  savingPassword = signal(false);
  savingEmail = signal(false);

  // Password visibility
  showCurrentPw = signal(false);
  showNewPw = signal(false);
  showConfirmPw = signal(false);
  showEmailPw = signal(false);

  // ── Forms ─────────────────────────────────────────────────────────────────
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  emailForm!: FormGroup;

  genderOptions = ['MALE', 'FEMALE', 'OTHER'];
  bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  ngOnInit(): void {
    this.initForms();
    this.loadProfile();
  }

  initForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      phone: ['', [Validators.minLength(10), Validators.maxLength(15)]],
      alternatePhone: ['', [Validators.minLength(10), Validators.maxLength(15)]],
      dateOfBirth: [''],
      gender: [''],
      bloodGroup: [''],
      avatarUrl: [''],
      addressLineOne: ['', [Validators.maxLength(255)]],
      addressLineTwo: ['', [Validators.maxLength(255)]],
      city: ['', [Validators.maxLength(100)]],
      state: ['', [Validators.maxLength(100)]],
      postalCode: ['', [Validators.maxLength(20)]],
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: [
          '',
          [Validators.required, Validators.minLength(8), Validators.maxLength(100)],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    this.emailForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
      currentPassword: ['', [Validators.required]],
    });
  }

  passwordMatchValidator(control: AbstractControl) {
    const newPw = control.get('newPassword')?.value;
    const confirmPw = control.get('confirmPassword')?.value;
    if (newPw && confirmPw && newPw !== confirmPw) {
      control.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  loadProfile(): void {
    this.loading.set(true);
    this.error.set(null);

    this.profileService.getMyProfile().subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.canEditProfile.set(res.canEditProfile);
        this.patchProfileForm(res.profile);

        // Disable form controls for read-only users so that even programmatic
        // attempts to submit are blocked at the UI layer (belt + suspenders).
        if (!res.canEditProfile) {
          this.profileForm.disable();
        } else {
          this.profileForm.enable();
        }

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load profile');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  patchProfileForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      alternatePhone: profile.alternatePhone ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: profile.gender ?? '',
      bloodGroup: profile.bloodGroup ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      addressLineOne: profile.addressLineOne ?? '',
      addressLineTwo: profile.addressLineTwo ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      postalCode: profile.postalCode ?? '',
    });
  }

  saveProfile(): void {
    // Double-guard: should never reach here for read-only users because the
    // button is hidden, but be defensive.
    if (!this.canEditProfile()) {
      this.toast.error('You do not have permission to edit profile information.');
      return;
    }

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);
    const data: UpdateProfilePayload = this.profileForm.getRawValue();

    this.profileService.updateMyProfile(data).subscribe({
      next: (res) => {
        this.toast.success(res.message ?? 'Profile updated');
        this.savingProfile.set(false);
        // Sync name change into auth signal so the sidebar updates instantly
        const current = this.auth.schoolUser();
        if (current && data.name) {
          this.auth.schoolUser.set({ ...current, name: data.name });
        }
        this.loadProfile();
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to update profile');
        this.savingProfile.set(false);
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);
    this.profileService.changePassword(this.passwordForm.value).subscribe({
      next: (res) => {
        this.toast.success(res.message ?? 'Password changed. Please log in again.');
        this.passwordForm.reset();
        this.savingPassword.set(false);
        setTimeout(() => this.auth.logout(), 2000);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to change password');
        this.savingPassword.set(false);
      },
    });
  }

  changeEmail(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.savingEmail.set(true);
    this.profileService.changeEmail(this.emailForm.value).subscribe({
      next: (res) => {
        this.toast.success(res.message ?? 'Email changed. Please log in again.');
        this.emailForm.reset();
        this.savingEmail.set(false);
        setTimeout(() => this.auth.logout(), 2000);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to change email');
        this.savingEmail.set(false);
      },
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  getProfileTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      student: 'Student',
      teacher: 'Teacher',
      parent: 'Parent / Guardian',
      staff: 'Staff Member',
      unknown: 'School Member',
      // Also handle raw primaryRole names (for fallback)
      STUDENT: 'Student',
      TEACHER: 'Teacher',
      STUDENT_PARENT: 'Parent / Guardian',
      SCHOOL_OWNER: 'School Owner',
      PRINCIPAL: 'Principal',
    };
    return labels[type] ?? type.replace(/_/g, ' ');
  }

  getProfileTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      student: 'school',
      teacher: 'cast_for_education',
      parent: 'family_restroom',
      staff: 'badge',
      unknown: 'person',
      STUDENT: 'school',
      TEACHER: 'cast_for_education',
      STUDENT_PARENT: 'family_restroom',
      SCHOOL_OWNER: 'star',
      PRINCIPAL: 'account_balance',
    };
    return icons[type] ?? 'person';
  }
}
