// src/app/shared/components/avatar-picker/avatar-picker.ts
//
// v2 — adds:
//   • A fixed-canvas crop/zoom/reposition step (ngx-image-cropper) between
//     file selection and upload, so the user controls exactly what gets
//     uploaded instead of a blind center-crop.
//   • A click-to-preview lightbox for the current avatar.
//   • An explicit recommended-ratio hint.

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
import { UserAvatarService } from '../../../core/services/user-avatar.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ImageCropperComponent,
  ],
  templateUrl: './avatar-picker.html',
  styleUrl: './avatar-picker.scss',
})
export class AvatarPicker {
  /** Existing avatar URL to show, if any (edit mode, or after creation-flow upload). */
  @Input() currentAvatarUrl: string | null = null;

  /** Fallback initial shown when there's no photo. */
  @Input() fallbackInitial = '?';

  /**
   * When provided, the component manages upload/remove itself. When omitted,
   * the component only crops + compresses + emits — the parent uploads later.
   */
  @Input() userId: number | null = null;

  /** Disables all interaction — e.g. while the parent form is submitting. */
  @Input() disabled = false;

  /** Emits the final compressed, ready-to-upload File after the user confirms the crop. */
  @Output() fileSelected = new EventEmitter<File>();

  /** Emits the new avatar URL once an immediate (userId-mode) upload succeeds. */
  @Output() uploaded = new EventEmitter<string>();

  /** Emits when the photo is removed (immediate mode only). */
  @Output() removed = new EventEmitter<void>();

  // ── Output dimensions for the final avatar (square) ─────────────────────
  readonly OUTPUT_SIZE = 480;

  // ── Display state ────────────────────────────────────────────────────────
  previewUrl = signal<string | null>(null);
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
    private avatarService: UserAvatarService,
    private toast: ToastService
  ) { }

  get displayUrl(): string | null {
    return this.previewUrl() ?? this.currentAvatarUrl;
  }

  get hasPhoto(): boolean {
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
      this.toast.error('Image is too large. Please choose a photo under 15MB.');
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
    this.toast.error('Could not load that image. Please try a different photo.');
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

  // ── Step 2: user confirms the crop → compress → emit / upload ───────────
  async confirmCrop(): Promise<void> {
    if (!this.pendingBlob) {
      this.toast.error('Please adjust the image before saving.');
      return;
    }

    try {
      const result = await this.compression.compressImageBlob(this.pendingBlob, {
        maxBytes: 50 * 1024,
      });
      this.compressedSizeLabel.set(`${Math.round(result.sizeBytes / 1024)}KB`);

      const dataUrl = await this.compression.readAsDataUrl(result.file);
      this.previewUrl.set(dataUrl);

      this.fileSelected.emit(result.file);
      this.closeCropper();

      if (this.userId) {
        await this.uploadNow(result.file);
      }
    } catch (err) {
      console.error('Avatar crop/compress failed:', err);
      this.toast.error('Could not process that image. Please try again.');
    }
  }

  private async uploadNow(file: File): Promise<void> {
    if (!this.userId) return;
    this.uploading.set(true);
    this.avatarService.uploadAvatar(this.userId, file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.toast.success('Profile photo updated');
        this.uploaded.emit(res.avatarUrl);
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(err?.error?.error ?? 'Failed to upload profile photo');
        this.previewUrl.set(null);
      },
    });
  }

  removePhoto(): void {
    if (this.disabled) return;

    if (this.userId) {
      this.uploading.set(true);
      this.avatarService.removeAvatar(this.userId).subscribe({
        next: () => {
          this.uploading.set(false);
          this.previewUrl.set(null);
          this.compressedSizeLabel.set(null);
          this.toast.success('Profile photo removed');
          this.removed.emit();
        },
        error: (err) => {
          this.uploading.set(false);
          this.toast.error(err?.error?.error ?? 'Failed to remove profile photo');
        },
      });
    } else {
      this.previewUrl.set(null);
      this.compressedSizeLabel.set(null);
      this.removed.emit();
    }
  }

  // ── Lightbox (full preview) ──────────────────────────────────────────────
  openLightbox(event: Event): void {
    event.stopPropagation();
    if (!this.hasPhoto || this.uploading()) return;
    this.lightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }
}