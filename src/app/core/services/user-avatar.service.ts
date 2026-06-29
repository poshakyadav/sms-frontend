// src/app/core/services/user-avatar.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserAvatarService {
  constructor(private http: HttpClient) {}

  /**
   * Uploads (or replaces) a user's profile photo. Sends multipart/form-data
   * directly via HttpClient rather than through ApiService, since ApiService's
   * post() always sets JSON content-type — file uploads need the browser to
   * set the multipart boundary itself, which happens automatically when you
   * pass a FormData body and let Angular's HttpClient omit the Content-Type
   * header entirely.
   */
  uploadAvatar(
    userId: number,
    file: File
  ): Observable<{ success: boolean; message: string; avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file, file.name);

    return this.http.post<{ success: boolean; message: string; avatarUrl: string }>(
      `${environment.apiUrl}/school/users/${userId}/avatar`,
      formData
    );
  }

  removeAvatar(userId: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${environment.apiUrl}/school/users/${userId}/avatar/remove`,
      {}
    );
  }
}
