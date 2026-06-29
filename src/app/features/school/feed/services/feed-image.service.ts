// features/school/feed/services/feed-image.service.ts

import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import imageCompression from 'browser-image-compression';
import { FeedService } from './feed.service';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/** Target ceiling after compression — matches backend presignImageSchema max (100KB headroom). */
const TARGET_MAX_BYTES = 50 * 1024; // 50 KB — the actual goal
const HARD_CEILING_BYTES = 100 * 1024; // backend rejects anything above this

/** Reject absurdly large uploads before even trying to compress them. */
const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

/** Cap the longest edge so huge phone-camera photos don't choke the canvas. */
const MAX_DIMENSION_PX = 1080;

/** Quality ladder for the iterative WebP compression loop. */
const QUALITY_STEPS = [0.8, 0.6, 0.4, 0.3] as const;

export interface UploadedFeedImage {
  imageUrl: string;
  imageKey: string;
}

export class FeedImageValidationError extends Error {}

@Injectable({ providedIn: 'root' })
export class FeedImageService {
  constructor(private feedService: FeedService) {}

  /**
   * Full pipeline: validate → compress → convert to WebP → presign → PUT to R2.
   * Returns the public CDN URL + R2 key to attach to the post payload.
   *
   * Throws FeedImageValidationError for user-facing validation issues
   * (wrong type, too large) so the calling component can show a clean message
   * instead of a generic "upload failed".
   */
  async compressAndUpload(file: File): Promise<UploadedFeedImage> {
    this.validateRawFile(file);

    const webpBlob = await this.compressToWebp(file);

    if (webpBlob.size > HARD_CEILING_BYTES) {
      // Should be unreachable given the quality floor, but guards against
      // pathological images (e.g. extremely high-detail images that don't
      // compress well even at quality 0.3).
      throw new FeedImageValidationError(
        'This image could not be compressed enough. Please try a different image.'
      );
    }

    const presign = await firstValueFrom(
      this.feedService.presignImage({
        contentType: 'image/webp',
        fileSizeBytes: webpBlob.size,
      })
    );

    await this.putToR2(presign.presignedUrl, webpBlob);

    return { imageUrl: presign.publicUrl, imageKey: presign.key };
  }

  /**
   * Produces a local preview URL immediately (no network call) so the admin
   * sees what they're about to upload before submitting the form.
   * Caller is responsible for calling URL.revokeObjectURL() when done
   * (e.g. in the dialog's ngOnDestroy or when the preview is replaced).
   */
  createLocalPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  private validateRawFile(file: File): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new FeedImageValidationError('Please choose a JPEG, PNG, or WebP image.');
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      throw new FeedImageValidationError('Image is too large. Please choose a file under 20 MB.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — COMPRESSION PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Step 1: browser-image-compression handles the heavy lifting — downscaling
   * dimensions and doing an initial size-aware compression pass. This also
   * normalizes EXIF orientation, which raw canvas.toBlob() does not do on
   * its own (a sideways phone photo would otherwise stay sideways).
   *
   * Step 2: convert the result to WebP via Canvas, iterating quality down
   * the QUALITY_STEPS ladder until under TARGET_MAX_BYTES or the floor is hit.
   */
  private async compressToWebp(file: File): Promise<Blob> {
    const preCompressed = await imageCompression(file, {
      maxSizeMB: TARGET_MAX_BYTES / (1024 * 1024), // 0.05 MB
      maxWidthOrHeight: MAX_DIMENSION_PX,
      useWebWorker: true,
      // We still do our own WebP pass below regardless of input type, so the
      // intermediate format here doesn't matter much — keep it as the
      // original type to avoid a redundant double re-encode.
      fileType: file.type,
    });

    const imageBitmap = await this.loadAsImageBitmap(preCompressed);

    for (const quality of QUALITY_STEPS) {
      const blob = await this.bitmapToWebpBlob(imageBitmap, quality);
      if (blob.size <= TARGET_MAX_BYTES) {
        imageBitmap.close();
        return blob;
      }
      // Keep the last attempt (lowest quality) as a fallback in case none
      // of the steps land under the target — better to ship a slightly
      // over-target image than to fail the upload entirely.
      if (quality === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
        imageBitmap.close();
        return blob;
      }
    }

    // Unreachable in practice (loop always returns), but keeps TS happy.
    imageBitmap.close();
    throw new FeedImageValidationError('Image compression failed.');
  }

  private loadAsImageBitmap(blob: Blob): Promise<ImageBitmap> {
    return createImageBitmap(blob);
  }

  private bitmapToWebpBlob(bitmap: ImageBitmap, quality: number): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new FeedImageValidationError('Canvas is not supported in this browser.');
    }
    ctx.drawImage(bitmap, 0, 0);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new FeedImageValidationError('Failed to encode image as WebP.'));
          }
        },
        'image/webp',
        quality
      );
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — R2 UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PUTs the compressed blob directly to the R2 presigned URL.
   *
   * IMPORTANT: we deliberately do NOT use Angular's HttpClient default
   * pipeline through ApiService here — this request goes straight to R2's
   * domain (*.r2.cloudflarestorage.com), not our API. We also must NOT set
   * a Content-Type header on this request, matching the backend's signing
   * decision (services.ts: "Do NOT include Content-Type in signed headers").
   * If we set a Content-Type header on the PUT, fetch/HttpClient would send
   * it, the signature wouldn't cover it, and R2 would reject with 403.
   *
   * We use the native fetch() API directly rather than HttpClient for this
   * one call, since HttpClient routes through any registered HTTP
   * interceptors (auth token attachment, base URL prefixing, etc.) that are
   * meant for OUR backend only — none of that should apply to a raw R2 PUT.
   */
  private async putToR2(presignedUrl: string, blob: Blob): Promise<void> {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
    });

    if (!response.ok) {
      throw new Error(
        `Image upload to storage failed (status ${response.status}). Please try again.`
      );
    }
  }
}
