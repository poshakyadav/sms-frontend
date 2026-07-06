// src/app/core/services/school-logo-upload.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SchoolLogoUploadService {
  constructor(private http: HttpClient) { }

  /**
   * Uploads (or replaces) the school's logo. Sends multipart/form-data
   * directly via HttpClient — same reasoning as UserAvatarService: letting
   * Angular's HttpClient handle a FormData body means the browser sets the
   * multipart boundary itself instead of a fixed JSON content-type.
   */
  uploadLogo(
    file: File
  ): Observable<{ success: boolean; message: string; logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file, file.name);

    return this.http.post<{ success: boolean; message: string; logoUrl: string }>(
      `${environment.apiUrl}/school/info/logo`,
      formData
    );
  }

  removeLogo(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${environment.apiUrl}/school/info/logo/remove`,
      {}
    );
  }
}