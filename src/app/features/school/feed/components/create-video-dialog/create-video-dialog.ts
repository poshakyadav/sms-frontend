// features/school/feed/components/create-video-dialog/create-video-dialog.ts

import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../../../core/services/toast.service';
import { FeedService } from '../../services/feed.service';
import { CreateFeedVideoInput, FeedPost, UpdateFeedPostInput } from '../../models/feed.models';
import { FeedTargetSelector, FeedTargetValue } from '../feed-target-selector/feed-target-selector';

const VIDEO_TITLE_MAX_LENGTH = 200;
const VIDEO_DESCRIPTION_MAX_LENGTH = 500;

// ─────────────────────────────────────────────────────────────────────────────
// Client-side YouTube ID extraction — mirrors extractYoutubeVideoId() in the
// backend's validators.ts EXACTLY (same patterns, same 11-char ID regex).
// Used here purely for the live thumbnail preview; the backend re-validates
// and re-extracts independently on submit, so this is not a security
// boundary — just a UX nicety.
// ─────────────────────────────────────────────────────────────────────────────

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
];

function extractYoutubeVideoIdClientSide(url: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1] && YOUTUBE_VIDEO_ID_REGEX.test(match[1])) {
      return match[1];
    }
  }
  return null;
}

@Component({
  selector: 'app-create-video-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, FeedTargetSelector],
  templateUrl: './create-video-dialog.html',
  styleUrl: './create-video-dialog.scss',
})
export class CreateVideoDialog {
  editingPost = input<FeedPost | null>(null);

  closed = output<void>();
  saved = output<FeedPost>();

  youtubeUrl = signal('');
  videoTitle = signal('');
  videoDescription = signal('');
  isPublished = signal(true);

  targetValue = signal<FeedTargetValue>({ targetAudience: 'ALL_SCHOOL', classSectionId: null });

  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  isEditMode = computed(() => this.editingPost() !== null);

  extractedVideoId = computed(() => extractYoutubeVideoIdClientSide(this.youtubeUrl().trim()));
  thumbnailUrl = computed(() => {
    const id = this.extractedVideoId();
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  });

  titleCharsRemaining = computed(() => VIDEO_TITLE_MAX_LENGTH - this.videoTitle().length);
  descriptionCharsRemaining = computed(
    () => VIDEO_DESCRIPTION_MAX_LENGTH - this.videoDescription().length
  );

  canSubmit = computed(() => {
    return (
      this.extractedVideoId() !== null &&
      this.videoTitle().trim().length > 0 &&
      this.videoTitle().length <= VIDEO_TITLE_MAX_LENGTH &&
      this.videoDescription().length <= VIDEO_DESCRIPTION_MAX_LENGTH &&
      !this.isSubmitting()
    );
  });

  constructor(private feedService: FeedService, private toast: ToastService) {
    const existing = this.editingPost();
    if (existing) {
      this.youtubeUrl.set(existing.youtubeUrl ?? '');
      this.videoTitle.set(existing.videoTitle ?? '');
      this.videoDescription.set(existing.videoDescription ?? '');
      this.isPublished.set(existing.isPublished);
      this.targetValue.set({
        targetAudience: existing.targetAudience,
        classSectionId: existing.classSectionId,
      });
    }
  }

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
      const target = this.targetValue();
      const existing = this.editingPost();

      if (existing) {
        const payload: UpdateFeedPostInput = {
          youtubeUrl: this.youtubeUrl().trim(),
          videoTitle: this.videoTitle().trim(),
          videoDescription: this.videoDescription().trim() || null,
          isPublished: this.isPublished(),
          targetAudience: target.targetAudience,
          classSectionId: target.classSectionId,
        };

        const res = await firstValueFrom(this.feedService.updatePost(existing.id, payload));
        this.toast.success('Video updated.');
        this.saved.emit(res.post);
      } else {
        const payload: CreateFeedVideoInput = {
          contentType: 'VIDEO',
          youtubeUrl: this.youtubeUrl().trim(),
          videoTitle: this.videoTitle().trim(),
          videoDescription: this.videoDescription().trim() || undefined,
          isPublished: this.isPublished(),
          targetAudience: target.targetAudience,
          classSectionId: target.classSectionId,
        };

        const res = await firstValueFrom(this.feedService.createPost(payload));
        this.toast.success('Video published.');
        this.saved.emit(res.post);
      }
    } catch (err: any) {
      const message = err?.error?.error || err?.message || 'Failed to save video.';
      this.errorMessage.set(message);
      this.toast.error(message);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
