// src/app/core/services/bulk-avatar-upload.service.ts

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface StudentForAvatarUpload {
  userId: number;
  name: string;
  avatarUrl: string | null;
  rollNumber: string | null;
  admissionNumber: string | null;
  gender: string | null;
  enrollmentId: number;

  fatherName: string | null;
  motherName: string | null;
  phone: string | null;
}

export interface BulkAvatarUploadResult {
  success: boolean;
  message: string;
  uploaded: { userId: number; avatarUrl: string }[];
  failed: { userId: number; error: string }[];
}

export interface BulkAvatarUploadItem {
  userId: number;
  file: File;
}

@Injectable({ providedIn: 'root' })
export class BulkAvatarUploadService {
  private api = inject(ApiService);

  getStudentsByClassSection(
    classSectionId: number
  ): Observable<{ success: boolean; students: StudentForAvatarUpload[] }> {
    return this.api.get(`school/users/class-section/${classSectionId}/students`);
  }

  /**
   * Uploads staged photos for multiple students in one request.
   * Each file is keyed as `avatar_<userId>` so the backend matches files to
   * students by field name rather than array position.
   */
  bulkUploadAvatars(items: BulkAvatarUploadItem[]): Observable<BulkAvatarUploadResult> {
    const formData = new FormData();
    formData.append('studentIds', JSON.stringify(items.map((i) => i.userId)));
    items.forEach((i) => {
      formData.append(`avatar_${i.userId}`, i.file, i.file.name || `${i.userId}.webp`);
    });
    return this.api.post<BulkAvatarUploadResult>('school/users/bulk-avatar-upload', formData);
  }
}