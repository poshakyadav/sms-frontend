// src/app/shared/components/avatar-picker/avatar-picker.ts
//
// Reusable circular profile-photo picker. Used in:
//   - user-creation-hub (optional, photo uploaded AFTER the user record is
//     created, since the upload endpoint needs a real userId)
//   - user-form edit screen ("Change Photo" — uploads immediately since the
//     user already exists)
//
// Design: this component does NOT call the upload HTTP endpoint itself when
// userId is not yet known (creation flow). Instead it compresses the file
// client-side and emits the compressed File via (fileSelected) — the parent
// decides when to actually upload (immediately if editing an existing user,
// or deferred until after user creation succeeds). When userId IS provided
// as an @Input, the component uploads immediately on selection and emits
// (uploaded)/(removed) — this is the simpler "edit mode" behavior.

import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImageCompressionService } from '../../../core/services/image-compression.service';
import { UserAvatarService } from '../../../core/services/user-avatar.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  templateUrl: './avatar-picker.html',
  styleUrl: './avatar-picker.scss',
})
export class AvatarPicker {
  /** Existing avatar URL to show, if any (edit mode, or after creation-flow upload). */
  @Input() currentAvatarUrl: string | null = null;

  /** Fallback initial shown when there's no photo (e.g. the user's first name letter). */
  @Input() fallbackInitial = '?';

  /**
   * When provided, the component manages upload/remove itself (calls the
   * backend directly). When omitted (undefined/null), the component only
   * compresses + emits — the parent (e.g. the creation hub, where the user
   * doesn't exist yet) is responsible for uploading after the fact.
   */
  @Input() userId: number | null = null;

  /** Disables all interaction — e.g. while the parent form is submitting. */
  @Input() disabled = false;

  /** Emits the compressed, ready-to-upload File whenever a new photo is picked
   *  (fires in BOTH modes — even when userId is set, so a parent can show its
   *  own "selected" state immediately without waiting for the network call). */
  @Output() fileSelected = new EventEmitter<File>();

  /** Emits the new avatar URL once an immediate (userId-mode) upload succeeds. */
  @Output() uploaded = new EventEmitter<string>();

  /** Emits when the photo is removed (immediate mode only). */
  @Output() removed = new EventEmitter<void>();

  previewUrl = signal<string | null>(null);
  uploading = signal(false);
  compressedSizeLabel = signal<string | null>(null);

  constructor(
    private compression: ImageCompressionService,
    private avatarService: UserAvatarService,
    private toast: ToastService
  ) {}

  get displayUrl(): string | null {
    return this.previewUrl() ?? this.currentAvatarUrl;
  }

  async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file.');
      return;
    }
    // Generous upper bound on the SOURCE file before we even try to compress —
    // protects against someone picking a 50MB RAW photo and freezing the tab.
    if (file.size > 15 * 1024 * 1024) {
      this.toast.error('Image is too large. Please choose a photo under 15MB.');
      return;
    }

    try {
      const quickPreview = await this.compression.readAsDataUrl(file);
      this.previewUrl.set(quickPreview);

      const result = await this.compression.compressSquareAvatar(file);
      this.compressedSizeLabel.set(`${Math.round(result.sizeBytes / 1024)}KB`);

      // Replace the quick preview with the actual compressed result so what
      // the user sees matches exactly what will be uploaded.
      const compressedPreview = await this.compression.readAsDataUrl(result.file);
      this.previewUrl.set(compressedPreview);

      this.fileSelected.emit(result.file);

      if (this.userId) {
        await this.uploadNow(result.file);
      }
    } catch (err) {
      console.error('Avatar compression failed:', err);
      this.toast.error('Could not process that image. Please try a different photo.');
      this.previewUrl.set(null);
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
      // Creation-flow mode — nothing uploaded yet, just clear local state.
      this.previewUrl.set(null);
      this.compressedSizeLabel.set(null);
      this.removed.emit();
    }
  }

  get hasPhoto(): boolean {
    return !!this.displayUrl;
  }
}
