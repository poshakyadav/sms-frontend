// profile.service.ts

import { Injectable } from '@angular/core';
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
  email: string;
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

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private api: ApiService) {}

  /**
   * Get the currently authenticated user's full profile.
   * The response now also carries `canEditProfile` — a boolean the backend
   * derives from the caller's JWT permissions (`users.edit` or `*`).
   * The frontend uses this flag to decide whether to render edit controls.
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
