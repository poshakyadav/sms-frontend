// src/app/core/services/image-data-url.service.ts
//
// Resolves a remote image URL (R2 photo/logo) into a data: URI up front,
// so by the time SnapDOM captures the DOM, the <img src> is already fully
// local. No network fetch, no CORS check — nothing left for SnapDOM's own
// image-inlining step to silently fail on.
//
// WHY THIS EXISTS: a plain <img> displays a cross-origin image fine with
// zero CORS headers (browsers only block *reading* pixels, not *painting*
// them) — but SnapDOM's internal fetch-and-inline step for that same image
// DOES enforce CORS, and it's a separate request from whatever made the
// tag render on screen. If that internal fetch is rejected, SnapDOM leaves
// a transparent hole. JPEG has no alpha channel, so exporting flattens
// that hole to solid BLACK — that's the black box replacing the photo.

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageDataUrlService {
  // Cache across the whole app session — a school logo repeats on every
  // card in a bulk print run, so this turns N fetches into 1.
  private cache = new Map<string, Promise<string | null>>();

  resolve(url: string | null | undefined): Promise<string | null> {
    if (!url) return Promise.resolve(null);
    if (url.startsWith('data:')) return Promise.resolve(url);
  
    const cached = this.cache.get(url);
    if (cached) return cached;
  
    const promise = this.fetchAsDataUrl(url).then((result) => {
      if (result === null) this.cache.delete(url); // allow retry
      return result;
    });
    this.cache.set(url, promise);
    return promise;
  }

  /** Drop a URL from cache — call this if a photo/logo was just replaced. */
  invalidate(url: string): void {
    this.cache.delete(url);
  }

  private async fetchAsDataUrl(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await this.blobToDataUrl(blob);
    } catch (err) {
      console.error('[ImageDataUrlService] Failed to resolve', url, err);
      return null;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}