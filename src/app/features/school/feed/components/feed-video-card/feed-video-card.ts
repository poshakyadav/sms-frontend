// features/school/feed/components/feed-video-card/feed-video-card.ts

import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FeedPost, FeedReactionType } from '../../models/feed.models';
import { FeedReactionBar } from '../feed-reaction-bar/feed-reaction-bar';

@Component({
  selector: 'app-feed-video-card',
  standalone: true,
  imports: [CommonModule, FeedReactionBar],
  templateUrl: './feed-video-card.html',
  styleUrl: './feed-video-card.scss',
})
export class FeedVideoCard implements AfterViewInit, OnDestroy {
  post = input.required<FeedPost>();
  canManage = input(false);

  react = output<{ postId: number; reactionType: FeedReactionType | null }>();
  edit = output<FeedPost>();
  deletePost = output<FeedPost>();
  togglePin = output<FeedPost>();

  @ViewChild('videoContainer') videoContainer?: ElementRef<HTMLDivElement>;

  /**
   * Two-stage lazy loading:
   *   1. isNearViewport — set true by IntersectionObserver when the card
   *      scrolls close to the viewport. Unlocks the click-to-play thumbnail.
   *   2. isPlaying — set true only when the user actually clicks play.
   *      The <iframe> is never rendered until this is true, so a feed of
   *      20 video posts never loads 20 YouTube players at once.
   */
  isNearViewport = signal(false);
  isPlaying = signal(false);

  private observer: IntersectionObserver | null = null;
  private safeEmbedUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngAfterViewInit(): void {
    if (!this.videoContainer) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.isNearViewport.set(true);
            this.observer?.disconnect();
          }
        }
      },
      { rootMargin: '200px' } // start "warming up" slightly before it's on screen
    );

    this.observer.observe(this.videoContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  play(): void {
    this.isPlaying.set(true);
  }

  get embedUrl(): SafeResourceUrl {
    if (!this.safeEmbedUrl) {
      const id = this.post().youtubeVideoId;
      const url = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`;
      this.safeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return this.safeEmbedUrl;
  }

  get thumbnailUrl(): string {
    return `https://img.youtube.com/vi/${this.post().youtubeVideoId}/hqdefault.jpg`;
  }

  onReact(reactionType: FeedReactionType | null): void {
    this.react.emit({ postId: this.post().id, reactionType });
  }

  humanizeAudience(value: string): string {
    return value
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
