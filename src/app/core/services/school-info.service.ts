// school-info.service.ts
// …/core/services/school-info.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dedicated service for school info API — wraps GET + PUT /school/info
// Useful if multiple components need to call these endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface SchoolInfoData {
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

export interface UpdateSchoolInfoPayload {
  name?: string;
  shortName?: string;
  tagline?: string;
  logoUrl?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  website?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
}

@Injectable({ providedIn: 'root' })
export class SchoolInfoService {
  constructor(private api: ApiService) {}

  /**
   * GET /school/info
   * Available to all authenticated school users.
   */
  getSchoolInfo(): Observable<{ success: boolean; school: SchoolInfoData }> {
    return this.api.get<{ success: boolean; school: SchoolInfoData }>('school/info').pipe(
      tap((res) => {
        // Keep localStorage in sync for the header (instant render on next load)
        if (res.success && res.school) {
          try {
            const existing = JSON.parse(localStorage.getItem('schoolInfo') ?? '{}');
            const updated = {
              ...existing,
              name: res.school.name,
              shortName: res.school.shortName,
              code: res.school.uniqueCode,
              logoUrl: res.school.logoUrl || null,
              tagline: res.school.tagline || null,
            };
            localStorage.setItem('schoolInfo', JSON.stringify(updated));
          } catch {
            // non-critical
          }
        }
      })
    );
  }

  /**
   * PUT /school/info
   * Requires settings.manage permission.
   */
  updateSchoolInfo(
    payload: UpdateSchoolInfoPayload
  ): Observable<{ success: boolean; message: string }> {
    return this.api.put<{ success: boolean; message: string }>('school/info', payload);
  }
}
