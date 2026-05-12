// users.service.ts

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { RoleCategory } from './roles.service';

// ── Permission Category Types ──────────────────────────────────────────────────
export type UserCategory = 'staff' | 'student' | 'parent';

export interface UserRole {
  id: number;
  name: string;
  description?: string;
  isSystem?: boolean;
  category?: RoleCategory;
}

export interface UserPermission {
  id: number;
  slug: string;
  name: string;
  module: string;
  category?: RoleCategory;
}

export interface UserProfile {
  type: 'student' | 'teacher' | 'parent' | 'staff' | null;
  data: Record<string, any> | null;
}

// ── UDISE+ Enum Types ──────────────────────────────────────────────────────────

export type EnrollmentType = 'REGULAR' | 'PRIVATE' | 'OPEN_SCHOOL';
export type PreviousClassResult = 'PROMOTED' | 'NOT_PROMOTED' | 'NEW_ADMISSION' | 'TRANSFERRED';
export type SocialCategory = 1 | 2 | 3 | 4 | 5; // 1=General, 2=SC, 3=ST, 4=OBC, 5=OBC-NCL
export type Religion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // Hindu–No Religion
export type LocalityType = 'URBAN' | 'RURAL';
export type DisabilityType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type FacilityReceived =
  | 'FREE_TEXTBOOKS'
  | 'FREE_UNIFORM'
  | 'FREE_TRANSPORT'
  | 'FREE_BICYCLE'
  | 'SCHOLARSHIP'
  | 'MID_DAY_MEAL'
  | 'FREE_STATIONERY'
  | 'OTHERS';

// ── Labels for UDISE+ dropdowns ────────────────────────────────────────────────

export const SOCIAL_CATEGORY_LABELS: Record<SocialCategory, string> = {
  1: 'General',
  2: 'SC (Scheduled Caste)',
  3: 'ST (Scheduled Tribe)',
  4: 'OBC (Other Backward Class)',
  5: 'OBC-NCL (Non Creamy Layer)',
};

export const RELIGION_LABELS: Record<Religion, string> = {
  1: 'Hindu',
  2: 'Muslim',
  3: 'Christian',
  4: 'Sikh',
  5: 'Buddhist',
  6: 'Jain',
  7: 'Others',
  8: 'No Religion',
};

export const DISABILITY_TYPE_LABELS: Record<DisabilityType, string> = {
  1: 'Visual Impairment',
  2: 'Hearing Impairment',
  3: 'Speech & Language',
  4: 'Locomotor Disability',
  5: 'Mental Retardation',
  6: 'Learning Disability',
  7: 'Autism',
  8: 'Multiple Disabilities',
  9: 'Others',
};

export const FACILITY_LABELS: Record<FacilityReceived, string> = {
  FREE_TEXTBOOKS: 'Free Textbooks',
  FREE_UNIFORM: 'Free Uniform',
  FREE_TRANSPORT: 'Free Transport',
  FREE_BICYCLE: 'Free Bicycle',
  SCHOLARSHIP: 'Scholarship',
  MID_DAY_MEAL: 'Mid-Day Meal',
  FREE_STATIONERY: 'Free Stationery',
  OTHERS: 'Others',
};

// ── SchoolUser interface (matches backend SAFE_USER_FIELDS + profile) ──────────

export interface SchoolUser {
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
  // NEW: Parental / guardian fields
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianRelation?: string;
  // Lifecycle
  isActive: boolean;
  termsAcceptedAt?: string | null;
  tokenVersion: number;
  createdAt: string;
  updatedAt?: string;
  roles: UserRole[];
  profile?: UserProfile | null;
}

// ── Student Profile Data (includes all UDISE+ fields) ─────────────────────────

export interface StudentProfileData {
  userId: number;
  // School-internal
  admissionNumber?: string | null;
  rollNumber?: string;
  admissionDate?: string;
  previousSchool?: string;
  medicalInfo?: string;
  enrollmentType: EnrollmentType;
  // UDISE / National identity
  pen?: string | null;
  apaarId?: string | null;
  stateStudentId?: string | null;
  aadhaarMasked?: string | null;
  aadhaarName?: string | null;
  previousSchoolUdiseCode?: string | null;
  // UDISE+ demographic
  previousClassResult?: PreviousClassResult | null;
  socialCategory?: SocialCategory | null;
  religion?: Religion | null;
  isMinority?: boolean;
  motherTongueCode?: number | null;
  // Socio-economic
  isBpl?: boolean;
  localityType?: LocalityType | null;
  // CWSN
  isCwsn?: boolean;
  disabilityType?: DisabilityType | null;
  hasDisabilityCertificate?: boolean;
  udidNumber?: string | null;
  // Facilities
  facilitiesReceived?: FacilityReceived[];
  // Verification flags
  isAadhaarVerified?: boolean;
  udiseVerified?: boolean;
}

// ── Deletion impact types ──────────────────────────────────────────────────────

export interface DeletionWarning {
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

export interface DeletionSummary {
  enrollments: number;
  attendanceRecords: number;
  feePayments: number;
  examMarks: number;
  assignments: number;
  submissions: number;
  linkedChildren: number;
  linkedParents: number;
}

export interface DeletionCheckResult {
  canDelete: boolean;
  blockingReason?: string;
  warnings: DeletionWarning[];
  summary: DeletionSummary;
  userInfo: {
    name: string;
    primaryRole: string;
    isActive: boolean;
  };
}

// ── CREATE payload ─────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  // Core
  name: string;
  email: string;
  password: string;
  primaryRoleId: number;
  roleIds: number[];

  // Common (school_users)
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

  // NEW: Parental / guardian fields (school_users)
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianRelation?: string;

  // Student — school-internal
  admissionNumber?: string;
  rollNumber?: string;
  admissionDate?: string;
  previousSchool?: string;
  medicalInfo?: string;
  enrollmentType?: EnrollmentType;

  // Student — UDISE / National identity
  pen?: string | null;
  apaarId?: string | null;
  stateStudentId?: string | null;
  aadhaarMasked?: string | null;
  aadhaarName?: string | null;
  previousSchoolUdiseCode?: string | null;

  // Student — UDISE+ demographic
  previousClassResult?: PreviousClassResult | null;
  socialCategory?: SocialCategory | null;
  religion?: Religion | null;
  isMinority?: boolean;
  motherTongueCode?: number | null;

  // Student — Socio-economic
  isBpl?: boolean;
  localityType?: LocalityType | null;

  // Student — CWSN
  isCwsn?: boolean;
  disabilityType?: DisabilityType | null;
  hasDisabilityCertificate?: boolean;
  udidNumber?: string | null;

  // Student — Facilities / schemes
  facilitiesReceived?: FacilityReceived[];

  // Student — Verification flags
  isAadhaarVerified?: boolean;
  udiseVerified?: boolean;

  // Teacher profile
  qualification?: string;
  experienceYears?: number;
  specialization?: string;
  joiningDate?: string;

  // Parent profile
  occupation?: string;

  // Staff profile
  department?: string;
  salary?: number;
  shift?: string;
}

// ── UPDATE payload (subset of create, no password/roleIds/primaryRoleId) ────────

export interface UpdateUserPayload
  extends Partial<Omit<CreateUserPayload, 'password' | 'roleIds' | 'primaryRoleId'>> {
  newPassword?: string;
  isActive?: boolean;
}

export interface AssignRolesPayload {
  roleIds: number[];
}

/**
 * Carries both grant IDs and denial IDs.
 * permissionIds        → extra permissions to GRANT beyond roles
 * deniedPermissionIds  → permissions to explicitly REVOKE from role inheritance
 */
export interface AssignPermissionsPayload {
  permissionIds: number[];
  deniedPermissionIds: number[];
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UsersService {
  private base = 'school/users';

  constructor(private api: ApiService) {}

  // ── Users CRUD ──────────────────────────────────────────────────────────────

  getUsers(): Observable<SchoolUser[]> {
    return this.api.get<{ success: boolean; users: SchoolUser[] }>(this.base).pipe(
      map((res) => res.users ?? []),
      catchError((err) => throwError(() => err))
    );
  }

  getUsersByCategory(category: UserCategory): Observable<SchoolUser[]> {
    const params = new HttpParams().set('category', category);
    return this.api
      .get<{ success: boolean; users: SchoolUser[]; category: string }>(
        `${this.base}/by-category`,
        params
      )
      .pipe(
        map((res) => res.users ?? []),
        catchError((err) => throwError(() => err))
      );
  }

  checkDeletionImpact(userId: number): Observable<DeletionCheckResult> {
    return this.api
      .get<{ success: boolean } & DeletionCheckResult>(`${this.base}/${userId}/deletion-check`)
      .pipe(
        map((res) => ({
          canDelete: res.canDelete,
          blockingReason: res.blockingReason,
          warnings: res.warnings ?? [],
          summary: res.summary,
          userInfo: res.userInfo,
        })),
        catchError((err) => throwError(() => err))
      );
  }

  getUserById(id: number): Observable<SchoolUser> {
    return this.api.get<{ success: boolean; user: SchoolUser }>(`${this.base}/${id}`).pipe(
      map((res) => res.user),
      catchError((err) => throwError(() => err))
    );
  }

  createUser(data: CreateUserPayload): Observable<{ message: string; user: SchoolUser }> {
    return this.api
      .post<{ success: boolean; message: string; user: SchoolUser }>(this.base, data)
      .pipe(
        map((res) => ({ message: res.message, user: res.user })),
        catchError((err) => throwError(() => err))
      );
  }

  updateUser(id: number, data: UpdateUserPayload): Observable<{ message: string }> {
    return this.api.put<{ success: boolean; message: string }>(`${this.base}/${id}`, data).pipe(
      map((res) => ({ message: res.message })),
      catchError((err) => throwError(() => err))
    );
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(`${this.base}/${id}`).pipe(
      map((res) => ({ message: res.message })),
      catchError((err) => throwError(() => err))
    );
  }

  toggleUserActive(id: number, isActive: boolean): Observable<{ message: string }> {
    return this.updateUser(id, { isActive });
  }

  // ── Roles ────────────────────────────────────────────────────────────────────

  getUserRoles(userId: number): Observable<UserRole[]> {
    return this.api
      .get<{ success: boolean; roles: UserRole[] }>(`${this.base}/${userId}/roles`)
      .pipe(
        map((res) => res.roles ?? []),
        catchError((err) => throwError(() => err))
      );
  }

  assignRoles(userId: number, roleIds: number[]): Observable<{ message: string }> {
    return this.api
      .put<{ success: boolean; message: string }>(`${this.base}/${userId}/roles`, { roleIds })
      .pipe(
        map((res) => ({ message: res.message })),
        catchError((err) => throwError(() => err))
      );
  }

  // ── Permissions ──────────────────────────────────────────────────────────────

  /** Returns the user's current direct permission GRANTS. */
  getUserDirectPermissions(userId: number): Observable<UserPermission[]> {
    return this.api
      .get<{ success: boolean; permissions: UserPermission[] }>(
        `${this.base}/${userId}/permissions`
      )
      .pipe(
        map((res) => res.permissions ?? []),
        catchError((err) => throwError(() => err))
      );
  }

  /** Returns the user's current permission DENIALS (revocations). */
  getUserDeniedPermissions(userId: number): Observable<UserPermission[]> {
    return this.api
      .get<{ success: boolean; permissions: UserPermission[] }>(
        `${this.base}/${userId}/denied-permissions`
      )
      .pipe(
        map((res) => res.permissions ?? []),
        catchError((err) => throwError(() => err))
      );
  }

  /**
   * Saves both extra grants and explicit denials atomically.
   * permissionIds        → IDs to GRANT (beyond what roles give)
   * deniedPermissionIds  → IDs to DENY (override and remove from role inheritance)
   */
  assignDirectPermissions(
    userId: number,
    permissionIds: number[],
    deniedPermissionIds: number[]
  ): Observable<{ message: string }> {
    return this.api
      .put<{ success: boolean; message: string }>(`${this.base}/${userId}/permissions`, {
        permissionIds,
        deniedPermissionIds,
      })
      .pipe(
        map((res) => ({ message: res.message })),
        catchError((err) => throwError(() => err))
      );
  }
}
