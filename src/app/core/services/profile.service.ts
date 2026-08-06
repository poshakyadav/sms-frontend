// profile.service.ts

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ProfileRole {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
}

export type ProfileType = 'student' | 'teacher' | 'parent' | 'staff' | 'unknown';

export interface StudentProfileData {
  type: 'student';
  rollNumber?: string;
  admissionDate?: string;
  previousSchool?: string;
  medicalInfo?: string;
}

export interface TeacherProfileData {
  type: 'teacher';
  qualification?: string;
  experienceYears?: number;
  joiningDate?: string;
  specialization?: string;
}

export interface ParentProfileData {
  type: 'parent';
  occupation?: string;
}

export interface StaffProfileData {
  type: 'staff';
  designation?: string;
  department?: string;
  joiningDate?: string;
  salary?: number;
  shift?: string;
}

export type ProfileData =
  | StudentProfileData
  | TeacherProfileData
  | ParentProfileData
  | StaffProfileData
  | null;

export interface UserProfile {
  id: number;
  name: string;
  /** Every school user has a username — used to log in alongside/instead of email. */
  username: string;
  /** Email is now OPTIONAL backend-side — a user may not have one on file. */
  email: string | null;
  primaryRole: string;
  phone?: string;
  alternatePhone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  roles: ProfileRole[];
  profileType: ProfileType;
  profileData: ProfileData;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  alternatePhone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangeEmailPayload {
  newEmail: string;
  currentPassword: string;
}

export interface ChangeUsernamePayload {
  username: string;
  currentPassword: string;
}

export interface UsernameAvailabilityResponse {
  success: boolean;
  available: boolean;
  message: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private api: ApiService) { }

  /**
   * Get the currently authenticated user's full profile.
   * The response also carries `canEditProfile` — a boolean the backend
   * derives from the caller's JWT permissions (`users.edit` or `*`).
   */
  getMyProfile(): Observable<{ profile: UserProfile; canEditProfile: boolean }> {
    return this.api.get<{ profile: UserProfile; canEditProfile: boolean }>('school/profile/me');
  }

  /**
   * Update general profile info (name, phone, address, etc.)
   * Requires `users.edit` permission on the backend — 403 if caller lacks it.
   */
  updateMyProfile(data: UpdateProfilePayload): Observable<{ success: boolean; message: string }> {
    return this.api.put<{ success: boolean; message: string }>('school/profile/me', data);
  }

  /**
   * Change the caller's own username. Self-service — available to every
   * authenticated user regardless of `users.edit` permission. Requires
   * current password confirmation.
   */
  changeUsername(
    data: ChangeUsernamePayload
  ): Observable<{ success: boolean; message: string; username: string }> {
    return this.api.put<{ success: boolean; message: string; username: string }>(
      'school/profile/me/change-username',
      data
    );
  }

  /**
   * Live availability check used by the "Change Username" form while typing.
   * Hits the self-service /school/profile/check-username endpoint (no
   * permission gate) — distinct from the admin-facing /school/users/check-username.
   */
  checkUsernameAvailability(username: string): Observable<UsernameAvailabilityResponse> {
    const params = new HttpParams().set('username', username);
    return this.api.get<UsernameAvailabilityResponse>('school/profile/check-username', params);
  }

  /** Change password — requires current password verification. Available to ALL users. */
  changePassword(data: ChangePasswordPayload): Observable<{ success: boolean; message: string }> {
    return this.api.put<{ success: boolean; message: string }>(
      'school/profile/me/change-password',
      data
    );
  }

  /** Change email — requires current password verification. Available to ALL users. */
  changeEmail(data: ChangeEmailPayload): Observable<{ success: boolean; message: string }> {
    return this.api.put<{ success: boolean; message: string }>(
      'school/profile/me/change-email',
      data
    );
  }
}