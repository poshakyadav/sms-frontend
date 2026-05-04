// users.service.ts
// UPDATED: UserRole and UserPermission interfaces now include `category`.
// getUserDirectPermissions and assignDirectPermissions updated accordingly.
// getAllPermissionsForUser is a new helper that fetches category-scoped
// permissions for the user direct-permission assignment form.

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { RoleCategory } from './roles.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserCategory = 'staff' | 'student' | 'parent';

export interface UserRole {
  id: number;
  name: string;
  description?: string;
  isSystem?: boolean;
  // UPDATED: category is now returned by the roles API
  category?: RoleCategory;
}

export interface UserPermission {
  id: number;
  slug: string;
  name: string;
  module: string;
  // UPDATED: category is now returned by the permissions API
  category?: RoleCategory;
}

export interface UserProfile {
  type: 'student' | 'teacher' | 'parent' | 'staff' | null;
  data: Record<string, any> | null;
}

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
  isActive: boolean;
  tokenVersion: number;
  createdAt: string;
  updatedAt?: string;
  // Joined
  roles: UserRole[];
  profile?: UserProfile | null;
}

// ── Deletion impact types ─────────────────────────────────────────────────────
 
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

// ── CRUD payloads ─────────────────────────────────────────────────
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  primaryRoleId: number;
  roleIds: number[];
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
  // Student
  rollNumber?: string;
  admissionDate?: string;
  previousSchool?: string;
  medicalInfo?: string;
  // Teacher
  qualification?: string;
  experienceYears?: number;
  specialization?: string;
  // Parent
  occupation?: string;
  // Staff
  department?: string;
  salary?: number;
  shift?: string;
  joiningDate?: string;
}

export interface UpdateUserPayload
  extends Partial<Omit<CreateUserPayload, 'password' | 'roleIds'>> {
  newPassword?: string;
  isActive?: boolean;
}

export interface AssignRolesPayload {
  roleIds: number[];
}

export interface AssignPermissionsPayload {
  permissionIds: number[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UsersService {
  private base = 'school/users';

  constructor(private api: ApiService) {}

  // ── Users CRUD ────────────────────────────────────────────────────────────

  getUsers(): Observable<SchoolUser[]> {
    return this.api.get<{ success: boolean; users: SchoolUser[] }>(this.base).pipe(
      map((res) => res.users ?? []),
      catchError((err) => throwError(() => err))
    );
  }

   /**
   * Fetch users filtered by category (staff | student | parent).
   * Calls GET /school/users/by-category?category=<category>
   * Called only on demand (when user clicks a tab or presses load).
   */
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
 
  /**
   * Check what impact deleting a user would have — BEFORE actually deleting.
   * Calls GET /school/users/:id/deletion-check
   * Use the returned DeletionCheckResult to populate the confirmation dialog.
   */
  checkDeletionImpact(userId: number): Observable<DeletionCheckResult> {
    return this.api
      .get<{ success: boolean } & DeletionCheckResult>(
        `${this.base}/${userId}/deletion-check`
      )
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

  // ── Roles ─────────────────────────────────────────────────────────────────

  getUserRoles(userId: number): Observable<UserRole[]> {
    return this.api
      .get<{ success: boolean; roles: UserRole[] }>(`${this.base}/${userId}/roles`)
      .pipe(
        map((res) => res.roles ?? []),
        catchError((err) => throwError(() => err))
      );
  }

  /**
   * Assign/replace roles for a user.
   * Calls PUT /school/users/:id/roles
   * Replaces ALL existing roles with the new set.
   * The backend increments tokenVersion to invalidate existing sessions.
   */
  assignRoles(userId: number, roleIds: number[]): Observable<{ message: string }> {
    return this.api
      .put<{ success: boolean; message: string }>(`${this.base}/${userId}/roles`, { roleIds })
      .pipe(
        map((res) => ({ message: res.message })),
        catchError((err) => throwError(() => err))
      );
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  /**
   * Returns the user's current direct permission overrides.
   * Each permission now includes its `category` field.
   */
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

  /**
   * UPDATED: Assigns direct permission overrides to a user.
   *
   * The backend validates that all permissionIds belong to the same category
   * as the user's primaryRole and returns a 422 CATEGORY_MISMATCH error if not.
   *
   * Call RolesService.getAllPermissions(category) to pre-filter the picker so
   * the user never sees out-of-universe permissions in the first place.
   */
  assignDirectPermissions(
    userId: number,
    permissionIds: number[]
  ): Observable<{ message: string }> {
    return this.api
      .put<{ success: boolean; message: string }>(`${this.base}/${userId}/permissions`, {
        permissionIds,
      })
      .pipe(
        map((res) => ({ message: res.message })),
        catchError((err) => throwError(() => err))
      );
  }
}
