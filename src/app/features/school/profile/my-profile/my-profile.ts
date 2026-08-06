// my-profile.ts — Universal profile for ALL roles
// Edit Profile tab is READ-ONLY for users without `users.edit` permission.
// Username, Password & Email tabs remain self-service for every authenticated user.

import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import {
  ProfileService,
  UpdateProfilePayload,
  UserProfile,
} from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

// Keep in sync with the backend's USERNAME_MIN_LENGTH / USERNAME_MAX_LENGTH
// (src/utils/school/username.ts). The client pattern is deliberately
// case-INSENSITIVE — the value is lowercased before it's sent, matching the
// backend's normalizeUsername() — so typing "JohnDoe" isn't blocked client-side
// only to be silently accepted by the server.
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_CLIENT_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

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
  private destroyRef = inject(DestroyRef);

  readonly usernameMinLength = USERNAME_MIN_LENGTH;
  readonly usernameMaxLength = USERNAME_MAX_LENGTH;

  // ── State ─────────────────────────────────────────────────────────────────
  profile = signal<UserProfile | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  /**
   * Whether the current user may edit profile fields (name, address, etc.).
   * Set from the `canEditProfile` flag returned by GET /school/profile/me.
   * Students, parents, and lower-staff get FALSE → read-only view.
   * Does NOT gate the Username / Password / Email tabs — those are
   * self-service for every user regardless of this flag.
   */
  canEditProfile = signal(false);

  // Form saving states
  savingProfile = signal(false);
  savingUsername = signal(false);
  savingPassword = signal(false);
  savingEmail = signal(false);

  // Password visibility
  showUsernamePw = signal(false);
  showCurrentPw = signal(false);
  showNewPw = signal(false);
  showConfirmPw = signal(false);
  showEmailPw = signal(false);

  // Live username availability
  checkingUsername = signal(false);
  usernameAvailable = signal<boolean | null>(null);

  // ── Forms ─────────────────────────────────────────────────────────────────
  profileForm!: FormGroup;
  usernameForm!: FormGroup;
  passwordForm!: FormGroup;
  emailForm!: FormGroup;

  genderOptions = ['MALE', 'FEMALE', 'OTHER'];
  bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  ngOnInit(): void {
    this.initForms();
    this.watchUsernameAvailability();
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

    this.usernameForm = this.fb.group({
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(USERNAME_MIN_LENGTH),
          Validators.maxLength(USERNAME_MAX_LENGTH),
          Validators.pattern(USERNAME_CLIENT_PATTERN),
        ],
      ],
      currentPassword: ['', [Validators.required]],
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

  /**
   * Debounced "is this username taken" check. Skips the network call for
   * empty/invalid input and for the user's own current username, so the
   * unchanged value never flashes a false "taken" state.
   */
  private watchUsernameAvailability(): void {
    this.usernameForm
      .get('username')!
      .valueChanges.pipe(
        map((value: string) => (value || '').trim().toLowerCase()),
        distinctUntilChanged(),
        debounceTime(400),
        switchMap((value) => {
          this.usernameAvailable.set(null);
          const control = this.usernameForm.get('username')!;

          if (!value || control.invalid || value === this.profile()?.username) {
            this.checkingUsername.set(false);
            return of(null);
          }

          this.checkingUsername.set(true);
          return this.profileService
            .checkUsernameAvailability(value)
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.checkingUsername.set(false);
        if (res) {
          this.usernameAvailable.set(res.available);
        }
      });
  }

  loadProfile(): void {
    this.loading.set(true);
    this.error.set(null);

    this.profileService.getMyProfile().subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.canEditProfile.set(res.canEditProfile);
        this.patchProfileForm(res.profile);
        this.usernameForm.patchValue({ username: res.profile.username }, { emitEvent: false });

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
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load profile');
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
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to update profile');
        this.savingProfile.set(false);
      },
    });
  }

  changeUsername(): void {
    if (this.usernameForm.invalid) {
      this.usernameForm.markAllAsTouched();
      return;
    }
    if (this.usernameAvailable() === false) {
      this.toast.error('This username is already taken. Please choose a different one.');
      return;
    }

    this.savingUsername.set(true);
    const username = (this.usernameForm.value.username || '').trim().toLowerCase();
    const currentPassword = this.usernameForm.value.currentPassword;

    this.profileService.changeUsername({ username, currentPassword }).subscribe({
      next: (res) => {
        this.toast.success(res.message ?? 'Username updated successfully');
        this.savingUsername.set(false);
        this.usernameForm.patchValue({ currentPassword: '' });
        this.usernameAvailable.set(null);

        // Username changes do NOT invalidate the current session (the JWT
        // doesn't encode it) — just sync the displayed value everywhere.
        const current = this.profile();
        if (current) {
          this.profile.set({ ...current, username: res.username });
        }
        const currentUser = this.auth.schoolUser();
        if (currentUser) {
          this.auth.schoolUser.set({ ...currentUser, username: res.username });
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to change username');
        this.savingUsername.set(false);
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
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to change password');
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
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to change email');
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