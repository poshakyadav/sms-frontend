// features/school/feed/components/create-post-dialog/create-post-dialog.ts

import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../../../core/services/toast.service';
import { FeedService } from '../../services/feed.service';
import { FeedImageService, FeedImageValidationError } from '../../services/feed-image.service';
import { CreateFeedPostInput, FeedPost, UpdateFeedPostInput } from '../../models/feed.models';
import { FeedTargetSelector, FeedTargetValue } from '../feed-target-selector/feed-target-selector';

const POST_TEXT_MAX_LENGTH = 1000;

@Component({
  selector: 'app-create-post-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, FeedTargetSelector],
  templateUrl: './create-post-dialog.html',
  styleUrl: './create-post-dialog.scss',
})
export class CreatePostDialog implements OnDestroy {
  /** Pass an existing post to edit it; omit/null for create mode. */
  editingPost = input<FeedPost | null>(null);

  closed = output<void>();
  saved = output<FeedPost>();

  postText = signal('');
  isPublished = signal(true);

  /** Currently selected image — either a brand new local file, or carried
   *  over from an existing post being edited. */
  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  /** Set when editing an existing post that already has an image, until the
   *  admin picks a new file or explicitly removes it. */
  existingImageUrl = signal<string | null>(null);
  existingImageKey = signal<string | null>(null);
  imageWasRemoved = signal(false);

  targetValue = signal<FeedTargetValue>({ targetAudience: 'ALL_SCHOOL', classSectionId: null });

  isUploadingImage = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  charCount = computed(() => this.postText().length);
  charsRemaining = computed(() => POST_TEXT_MAX_LENGTH - this.charCount());
  isOverLimit = computed(() => this.charCount() > POST_TEXT_MAX_LENGTH);

  isEditMode = computed(() => this.editingPost() !== null);

  canSubmit = computed(() => {
    return (
      this.postText().trim().length > 0 &&
      !this.isOverLimit() &&
      !this.isSubmitting() &&
      !this.isUploadingImage()
    );
  });

  private objectUrlToRevoke: string | null = null;

  constructor(
    private feedService: FeedService,
    private feedImageService: FeedImageService,
    private toast: ToastService
  ) {
    const existing = this.editingPost();
    if (existing) {
      this.postText.set(existing.postText ?? '');
      this.isPublished.set(existing.isPublished);
      this.existingImageUrl.set(existing.imageUrl);
      this.existingImageKey.set(existing.imageKey);
      this.targetValue.set({
        targetAudience: existing.targetAudience,
        classSectionId: existing.classSectionId,
      });
    }
  }

  ngOnDestroy(): void {
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.errorMessage.set(null);

    // Replace any previous local preview.
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
    }

    const preview = this.feedImageService.createLocalPreviewUrl(file);
    this.objectUrlToRevoke = preview;

    this.selectedFile.set(file);
    this.previewUrl.set(preview);
    this.imageWasRemoved.set(false);
  }

  removeImage(): void {
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
      this.objectUrlToRevoke = null;
    }
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.existingImageUrl.set(null);
    this.existingImageKey.set(null);
    this.imageWasRemoved.set(true);
  }

  /** What to actually show in the preview area — new file, existing image, or nothing. */
  displayImageUrl = computed(() => this.previewUrl() ?? this.existingImageUrl());

  onTargetChange(value: FeedTargetValue): void {
    this.targetValue.set(value);
  }

  close(): void {
    this.closed.emit();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      let imageUrl: string | null | undefined = this.existingImageUrl();
      let imageKey: string | null | undefined = this.existingImageKey();

      // A new file was chosen — compress + upload it now, right before submit,
      // so cancelled dialogs never orphan an R2 object.
      const file = this.selectedFile();
      if (file) {
        this.isUploadingImage.set(true);
        const uploaded = await this.feedImageService.compressAndUpload(file);
        imageUrl = uploaded.imageUrl;
        imageKey = uploaded.imageKey;
        this.isUploadingImage.set(false);
      } else if (this.imageWasRemoved()) {
        imageUrl = null;
        imageKey = null;
      }

      const target = this.targetValue();
      const existing = this.editingPost();

      if (existing) {
        const payload: UpdateFeedPostInput = {
          postText: this.postText().trim(),
          isPublished: this.isPublished(),
          targetAudience: target.targetAudience,
          classSectionId: target.classSectionId,
        };
        // Only include image fields if something actually changed, to avoid
        // unnecessarily triggering the backend's R2-cleanup-on-change branch.
        if (file || this.imageWasRemoved()) {
          payload.imageUrl = imageUrl ?? null;
          payload.imageKey = imageKey ?? null;
        }

        const res = await firstValueFrom(this.feedService.updatePost(existing.id, payload));
        this.toast.success('Post updated.');
        this.saved.emit(res.post);
      } else {
        const payload: CreateFeedPostInput = {
          contentType: 'POST',
          postText: this.postText().trim(),
          isPublished: this.isPublished(),
          targetAudience: target.targetAudience,
          classSectionId: target.classSectionId,
          ...(imageUrl ? { imageUrl, imageKey: imageKey ?? undefined } : {}),
        };

        const res = await firstValueFrom(this.feedService.createPost(payload));
        this.toast.success('Post published.');
        this.saved.emit(res.post);
      }
    } catch (err: any) {
      this.isUploadingImage.set(false);

      if (err instanceof FeedImageValidationError) {
        this.errorMessage.set(err.message);
      } else {
        const message = err?.error?.error || err?.message || 'Failed to save post.';
        this.errorMessage.set(message);
        this.toast.error(message);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
