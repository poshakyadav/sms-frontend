// src/app/core/services/image-compression.service.ts
//
// Shared client-side image compression utility. Used by the avatar upload
// flow (and matches the same approach already used for feed-post images
// per the school_feed_posts schema comments: "Canvas API → WebP blob →
// upload"). Centralizing this means every image-upload feature in the app
// compresses consistently rather than each component reinventing the
// resize/quality-search loop.

import { Injectable } from '@angular/core';

export interface CompressedImageResult {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  sizeBytes: number;
}

@Injectable({ providedIn: 'root' })
export class ImageCompressionService {
  /**
   * Compresses an image file to a target maximum byte size, returning a
   * WebP blob. Uses a square center-crop for avatars (square is the
   * universal profile-photo aspect ratio — consistent circular/rounded
   * rendering everywhere in the UI regardless of the source photo's shape).
   *
   * Algorithm:
   *   1. Decode the source file into an HTMLImageElement
   *   2. Center-crop to a square, then downscale to `maxDimension`
   *   3. Encode as WebP, binary-searching the quality parameter until the
   *      result is at or under `maxBytes` (or quality bottoms out at 0.4,
   *      below which further compression isn't worth the visual cost)
   */
  async compressSquareAvatar(
    file: File,
    options: { maxDimension?: number; maxBytes?: number } = {}
  ): Promise<CompressedImageResult> {
    const maxDimension = options.maxDimension ?? 480; // px — plenty for any on-screen avatar size, including @2x retina at ~240 CSS px
    const maxBytes = options.maxBytes ?? 50 * 1024; // 50KB target, matching the feed-image convention

    const img = await this.loadImage(file);
    const canvas = this.cropToSquareCanvas(img, maxDimension);

    let quality = 0.85;
    let blob = await this.canvasToWebpBlob(canvas, quality);

    // Binary-search quality downward until under the byte budget, or until
    // further reduction stops being worthwhile.
    let low = 0.4;
    let high = quality;
    let attempts = 0;
    while (blob.size > maxBytes && attempts < 6) {
      quality = (low + high) / 2;
      blob = await this.canvasToWebpBlob(canvas, quality);
      if (blob.size > maxBytes) {
        high = quality;
      } else {
        low = quality;
      }
      attempts++;
    }

    // If still over budget at the quality floor, shrink dimensions further
    // rather than degrading quality below an acceptable visual floor.
    if (blob.size > maxBytes && maxDimension > 240) {
      return this.compressSquareAvatar(file, {
        maxDimension: Math.round(maxDimension * 0.75),
        maxBytes,
      });
    }

    const resultFile = new File([blob], 'avatar.webp', { type: 'image/webp' });

    return {
      blob,
      file: resultFile,
      width: canvas.width,
      height: canvas.height,
      sizeBytes: blob.size,
    };
  }

  /** Produces a small data URL for instant on-screen preview before/while compressing. */
  async readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  private cropToSquareCanvas(img: HTMLImageElement, targetSize: number): HTMLCanvasElement {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);
    return canvas;
  }

  private canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
        'image/webp',
        quality
      );
    });
  }
}
