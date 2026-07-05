// src/app/shared/components/post-image-picker/post-image-picker.ts

import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  ImageCropperComponent,
  ImageCroppedEvent,
  ImageTransform,
} from 'ngx-image-cropper';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-post-image-picker',
  standalone: true,
  imports: [CommonModule, MatIconModule, ImageCropperComponent],
  templateUrl: './post-image-picker.html',
  styleUrl: './post-image-picker.scss',
})
export class PostImagePicker {
  /** Existing image URL to show, if any (edit mode) — the fallback once no local pick exists. */
  @Input() currentImageUrl: string | null = null;

  @Input() disabled = false;

  /** Emits the cropped File. Upload/compression is the PARENT's job (deferred until submit). */
  @Output() fileSelected = new EventEmitter<File>();

  /** Emits when the image is cleared (undo a fresh pick, or drop the existing image). */
  @Output() removed = new EventEmitter<void>();

  readonly OUTPUT_WIDTH = 1280;
  readonly OUTPUT_HEIGHT = 720;
  readonly ASPECT_RATIO = 16 / 9;

  previewUrl = signal<string | null>(null);

  lightboxOpen = signal(false);

  cropperOpen = signal(false);
  cropperViewReady = signal(false);
  zoom = signal(1);
  transform: ImageTransform = { scale: 1 };
  imageChangedEvent: Event | null = null;

  private pendingBlob: Blob | null = null;
  private fileInputEl: HTMLInputElement | null = null;
  private objectUrlToRevoke: string | null = null;

  constructor(private toast: ToastService) {}

  get displayUrl(): string | null {
    return this.previewUrl() ?? this.currentImageUrl;
  }

  get hasImage(): boolean {
    return !!this.displayUrl;
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file.');
      input.value = '';
      return;
    }
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
  }

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

  confirmCrop(): void {
    if (!this.pendingBlob) {
      this.toast.error('Please adjust the image before saving.');
      return;
    }

    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
    }
    const url = URL.createObjectURL(this.pendingBlob);
    this.objectUrlToRevoke = url;
    this.previewUrl.set(url);

    const file = new File([this.pendingBlob], `feed-image-${Date.now()}.webp`, {
      type: this.pendingBlob.type || 'image/webp',
    });

    this.closeCropper();
    this.fileSelected.emit(file);
  }

  removeImage(): void {
    if (this.disabled) return;
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
      this.objectUrlToRevoke = null;
    }
    this.previewUrl.set(null);
    this.removed.emit();
  }

  openLightbox(event: Event): void {
    event.stopPropagation();
    if (!this.hasImage) return;
    this.lightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }
}