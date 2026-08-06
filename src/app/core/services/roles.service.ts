// roles.service.ts
// UPDATED: Role interface now includes `category`. getAllPermissions accepts
// an optional `category` query param. RoleTemplate includes `category`.

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export type RoleCategory = 'staff' | 'student' | 'parent';

// NEW — mirrors the backend's PermissionRiskLevel
export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Permission {
  id: number;
  slug: string;
  name: string;
  module: string;
  description?: string;
  category?: RoleCategory;

  // populated by the backend's read-time enrichment
  riskLevel?: PermissionRiskLevel;
  usedIn?: string[];
}

export interface Role {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  // UPDATED: every role now has a category
  category: RoleCategory;
  createdAt?: string;
  permissions: Permission[];
  permissionCount?: number;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  // UPDATED: templates now declare their category
  category: RoleCategory;
  permissionSlugs: string[];
}

export interface CreateRolePayload {
  name: string;
  description: string;
  permissionIds: number[];
  // UPDATED: category is now required for role creation
  category: RoleCategory;
  templateId?: string;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  permissionIds?: number[];
  // NOTE: category is intentionally absent — immutable after creation
}

export interface CloneRolePayload {
  name: string;
  description?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RolesService {
  constructor(private api: ApiService) {}

  // ── Roles ──────────────────────────────────────────────────────────────────

  getAllRoles(): Observable<{ roles: Role[] }> {
    return this.api.get<{ roles: Role[] }>('school/roles');
  }

  getRoleById(id: number): Observable<{ role: Role }> {
    return this.api.get<{ role: Role }>(`school/roles/${id}`);
  }

  createRole(data: CreateRolePayload): Observable<{ role: Role; message: string }> {
    return this.api.post<{ role: Role; message: string }>('school/roles', data);
  }

  updateRole(id: number, data: UpdateRolePayload): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`school/roles/${id}`, data);
  }

  cloneRole(id: number, data: CloneRolePayload): Observable<{ role: Role; message: string }> {
    return this.api.post<{ role: Role; message: string }>(`school/roles/${id}/clone`, data);
  }

  deleteRole(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`school/roles/${id}`);
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  getRoleTemplates(): Observable<{ templates: RoleTemplate[] }> {
    return this.api.get<{ templates: RoleTemplate[] }>('school/roles/templates/list');
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  /**
   * UPDATED: Accepts an optional `category` param.
   *
   * When category is provided, the backend returns ONLY permissions
   * belonging to that universe (staff | student | parent).
   *
   * Call this with a category whenever rendering a permission picker
   * for role creation/editing or user direct-permission assignment.
   * Omit category only if you genuinely need all permissions (e.g. super admin).
   *
   * @param category - optional filter: 'staff' | 'student' | 'parent'
   */
  getAllPermissions(category?: RoleCategory): Observable<{ permissions: Permission[] }> {
    const params = category ? new HttpParams().set('category', category) : undefined;
    return this.api.get<{ permissions: Permission[] }>('school/permissions', params);
  }

  /** Groups permissions by their module prefix for UI display */
  getPermissionsGrouped(category?: RoleCategory): Observable<Record<string, Permission[]>> {
    return this.getAllPermissions(category).pipe(
      map((res) => {
        return res.permissions.reduce((acc, perm) => {
          const module = perm.module || 'Other';
          if (!acc[module]) acc[module] = [];
          acc[module].push(perm);
          return acc;
        }, {} as Record<string, Permission[]>);
      })
    );
  }
}
