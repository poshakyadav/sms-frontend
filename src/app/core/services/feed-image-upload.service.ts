// src/app/core/services/feed-image-upload.service.ts
//
// Wraps the two-step R2 upload flow for feed post images:
//   1. FeedService.presignImage() → { presignedUrl, key, publicUrl }
//   2. PUT the compressed file straight to R2 from the browser
//
// IMPORTANT: The PUT must send ONLY the Content-Type header — nothing else.
// The backend's generateFeedImagePresignedUrl() signs with signQuery:true
// and only signs "host" (see services.ts comment). Any extra header here
// (Authorization, X-School-Code, etc.) is fine since fetch() to a different
// origin (r2.cloudflarestorage.com) won't carry your app's interceptor
// headers anyway — just don't manually add any beyond Content-Type, or a
// CORS preflight will demand you allowlist them too.

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FeedService } from '../../features/school/feed/services/feed.service';

export interface UploadedFeedImage {
  imageUrl: string;
  imageKey: string;
}

@Injectable({ providedIn: 'root' })
export class FeedImageUploadService {
  private feedService = inject(FeedService);

  async upload(file: File): Promise<UploadedFeedImage> {
    const contentType = this.resolveContentType(file);

    const presign = await firstValueFrom(
      this.feedService.presignImage({
        contentType,
        fileSizeBytes: file.size,
      })
    );

    const putResponse = await fetch(presign.presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });

    if (!putResponse.ok) {
      throw new Error(`R2 upload failed with status ${putResponse.status}`);
    }

    return { imageUrl: presign.publicUrl, imageKey: presign.key };
  }

  /** Backend only accepts webp/jpeg/png — fall back to jpeg for anything else. */
  private resolveContentType(file: File): 'image/webp' | 'image/jpeg' | 'image/png' {
    if (file.type === 'image/webp' || file.type === 'image/png') return file.type;
    return 'image/jpeg';
  }
}