// src/app/shared/components/school-logo-picker/school-logo-picker.ts
//
// Crop/zoom/reposition logo picker — mirrors avatar-picker.ts's pattern
// (ngx-image-cropper step between file selection and upload) adapted for a
// single school-wide logo: square non-circular crop, direct upload via
// SchoolLogoUploadService (no id needed — scoped by JWT/X-School-Code).

import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ImageCropperComponent,
  ImageCroppedEvent,
  ImageTransform,
} from 'ngx-image-cropper';
import { ImageCompressionService } from '../../../core/services/image-compression.service';
import { SchoolLogoUploadService } from '../../../core/services/school-logo-upload.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-school-logo-picker',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ImageCropperComponent,
  ],
  templateUrl: './school-logo-picker.html',
  styleUrl: './school-logo-picker.scss',
})
export class SchoolLogoPicker {
  /** Existing logo URL to show, if any. */
  @Input() currentLogoUrl: string | null = null;

  /** Disables all interaction — e.g. while the parent form is submitting. */
  @Input() disabled = false;

  /** Emits the new logo URL once upload succeeds. */
  @Output() uploaded = new EventEmitter<string>();

  /** Emits when the logo is removed. */
  @Output() removed = new EventEmitter<void>();

  // ── Output dimensions for the final logo (square) ────────────────────────
  readonly OUTPUT_SIZE = 512;

  // ── Display state ────────────────────────────────────────────────────────
  previewUrl = signal<string | null>(null);
  previewError = signal(false);
  uploading = signal(false);
  compressedSizeLabel = signal<string | null>(null);

  // ── Lightbox (full preview) ──────────────────────────────────────────────
  lightboxOpen = signal(false);

  // ── Cropper modal state ──────────────────────────────────────────────────
  cropperOpen = signal(false);
  cropperViewReady = signal(false);
  zoom = signal(1);
  transform: ImageTransform = { scale: 1 };
  imageChangedEvent: Event | null = null;

  private pendingBlob: Blob | null = null;
  private fileInputEl: HTMLInputElement | null = null;

  constructor(
    private compression: ImageCompressionService,
    private logoService: SchoolLogoUploadService,
    private toast: ToastService
  ) { }

  get displayUrl(): string | null {
    const url = this.previewUrl() ?? this.currentLogoUrl;
    return url && !this.previewError() ? url : null;
  }

  get hasLogo(): boolean {
    return !!this.displayUrl;
  }

  // ── Step 1: file picked → validate, then open the cropper (no upload yet) ─
  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file.');
      input.value = '';
      return;
    }
    // Upper bound on the SOURCE file before we even try to load/crop it.
    if (file.size > 15 * 1024 * 1024) {
      this.toast.error('Image is too large. Please choose a file under 15MB.');
      input.value = '';
      return;
    }

    this.fileInputEl = input;
    this.imageChangedEvent = event;
    this.zoom.set(1);
    this.transform = { scale: 1 };
    this.cropperViewReady.set(false);
    this.pendingBlob = null;
    this.cropperOpen.set(true);
    // Note: input.value is intentionally NOT reset here — ngx-image-cropper
    // reads the file off this same event/input. It's reset in closeCropper().
  }

  // ── Cropper lifecycle ───────────────────────────────────────────────────

  onCropperReady(): void {
    this.cropperViewReady.set(true);
  }

  loadImageFailed(): void {
    this.toast.error('Could not load that image. Please try a different file.');
    this.closeCropper();
  }

  imageCropped(event: ImageCroppedEvent): void {
    this.pendingBlob = event.blob ?? null;
  }

  onZoomChange(value: number): void {
    this.zoom.set(value);
    this.transform = { ...this.transform, scale: value };
  }

  /** Keeps the slider in sync when the user zooms via scroll/pinch instead of the slider. */
  onTransformChange(t: ImageTransform): void {
    this.transform = t;
    if (typeof t.scale === 'number') this.zoom.set(t.scale);
  }

  closeCropper(): void {
    this.cropperOpen.set(false);
    this.cropperViewReady.set(false);
    this.imageChangedEvent = null;
    this.pendingBlob = null;
    if (this.fileInputEl) this.fileInputEl.value = '';
  }

  // ── Step 2: user confirms the crop → compress → upload ───────────────────
  async confirmCrop(): Promise<void> {
    if (!this.pendingBlob) {
      this.toast.error('Please adjust the image before saving.');
      return;
    }

    try {
      const result = await this.compression.compressImageBlob(this.pendingBlob, {
        maxBytes: 100 * 1024,
      });
      this.compressedSizeLabel.set(`${Math.round(result.sizeBytes / 1024)}KB`);

      const dataUrl = await this.compression.readAsDataUrl(result.file);
      this.previewUrl.set(dataUrl);
      this.previewError.set(false);

      this.closeCropper();
      await this.uploadNow(result.file);
    } catch (err) {
      console.error('Logo crop/compress failed:', err);
      this.toast.error('Could not process that image. Please try again.');
    }
  }

  private async uploadNow(file: File): Promise<void> {
    this.uploading.set(true);
    this.logoService.uploadLogo(file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.toast.success('School logo updated successfully!');
        this.uploaded.emit(res.logoUrl);
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(err?.error?.error ?? 'Failed to upload school logo');
        this.previewUrl.set(null);
      },
    });
  }

  removeLogo(): void {
    if (this.disabled) return;

    this.uploading.set(true);
    this.logoService.removeLogo().subscribe({
      next: () => {
        this.uploading.set(false);
        this.previewUrl.set(null);
        this.compressedSizeLabel.set(null);
        this.toast.success('School logo removed');
        this.removed.emit();
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(err?.error?.error ?? 'Failed to remove school logo');
      },
    });
  }

  onDisplayImageError(): void {
    this.previewError.set(true);
  }

  // ── Lightbox (full preview) ──────────────────────────────────────────────
  openLightbox(event: Event): void {
    event.stopPropagation();
    if (!this.hasLogo || this.uploading()) return;
    this.lightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }
}