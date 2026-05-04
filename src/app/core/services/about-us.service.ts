// src/app/core/services/about-us.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// About Us API service — used by the viewer and the editor
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Shared domain types ───────────────────────────────────────────────────────

export interface CoreValue {
  title: string;
  description: string;
}

export interface Achievement {
  year?: number;
  title: string;
  description: string;
}

export interface AboutUsData {
  id: number;
  schoolId: number;
  description: string;
  mission: string;
  vision: string;
  foundedYear: number | null;
  foundedBy: string;
  history: string;
  affiliationBoard: string;
  affiliationNumber: string;
  accreditation: string;
  totalStudents: number | null;
  totalTeachers: number | null;
  totalStaff: number | null;
  campusAreaAcres: string;
  principalName: string;
  principalMessage: string;
  principalAvatarUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  linkedinUrl: string;
  facilities: string[];
  galleryUrls: string[];
  coreValues: CoreValue[];
  achievements: Achievement[];
  createdAt: string;
  updatedAt: string;
}

/** Only the mutable fields; id, schoolId, timestamps are server-managed */
export type UpdateAboutUsPayload = Partial<
  Omit<AboutUsData, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>
>;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AboutUsService {
  constructor(private api: ApiService) {}

  /**
   * GET /school/about-us
   * Accessible to all authenticated school users.
   * The backend auto-seeds an empty row if one doesn't exist yet.
   */
  getAboutUs(): Observable<{ success: boolean; aboutUs: AboutUsData }> {
    return this.api.get<{ success: boolean; aboutUs: AboutUsData }>('school/about-us');
  }

  /**
   * PUT /school/about-us
   * Partial update — only the keys you send are written.
   * Requires settings.manage permission.
   */
  updateAboutUs(
    payload: UpdateAboutUsPayload
  ): Observable<{ success: boolean; message: string; aboutUs: AboutUsData }> {
    return this.api.put<{ success: boolean; message: string; aboutUs: AboutUsData }>(
      'school/about-us',
      payload
    );
  }
}
