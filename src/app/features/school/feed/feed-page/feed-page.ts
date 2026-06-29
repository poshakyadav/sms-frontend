// features/school/feed/feed-page/feed-page.ts

import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedService } from '../services/feed.service';
import { ParentService } from '../../../../core/services/parent.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FeedPost, FeedReactionType, ReactToPostResponse, RemoveReactionResponse } from '../models/feed.models';
import { FeedPostCard } from '../components/feed-post-card/feed-post-card';
import { FeedVideoCard } from '../components/feed-video-card/feed-video-card';
import { Observable } from 'rxjs';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-feed-page',
  standalone: true,
  imports: [CommonModule, FeedPostCard, FeedVideoCard],
  templateUrl: './feed-page.html',
  styleUrl: './feed-page.scss',
})
export class FeedPage implements OnInit {
  posts = signal<FeedPost[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  errorMessage = signal<string | null>(null);

  offset = signal(0);
  hasMore = signal(false);

  /** Tracks whether the initial load has happened, so the reactive effect
   *  below doesn't double-fire alongside ngOnInit on first render. */
  private hasLoadedOnce = false;

  constructor(
    private feedService: FeedService,
    private authService: AuthService,
    private parentService: ParentService
  ) {
    // ── Re-fetch the feed whenever a parent switches their active child ────
    // ParentService.activeChildId is a signal; switching children (via the
    // child switcher elsewhere in the app) updates it, and the
    // authInterceptor reads it fresh on every request — but nothing
    // automatically triggers a refetch on this already-rendered page unless
    // we react to it explicitly here.
    effect(() => {
      const childId = this.parentService.activeChildId();

      // Only relevant for parent accounts; for students/staff this signal
      // stays null forever and the effect does nothing extra.
      if (this.authService.userRole() !== 'STUDENT_PARENT') return;

      // Skip the very first run — ngOnInit's loadFeed(true) already covers
      // the initial load, including whatever child is active at that point.
      if (!this.hasLoadedOnce) return;

      this.loadFeed(true);
    });
  }

  ngOnInit(): void {
    this.loadFeed(true);
    this.hasLoadedOnce = true;
  }

  loadFeed(isInitial: boolean): void {
    if (isInitial) {
      this.isLoading.set(true);
      this.offset.set(0);
    } else {
      this.isLoadingMore.set(true);
    }
    this.errorMessage.set(null);

    this.feedService
      .listFeed({ limit: PAGE_SIZE, offset: isInitial ? 0 : this.offset() })
      .subscribe({
        next: (res) => {
          if (isInitial) {
            this.posts.set(res.posts);
          } else {
            this.posts.set([...this.posts(), ...res.posts]);
          }
          this.offset.set((isInitial ? 0 : this.offset()) + res.posts.length);
          this.hasMore.set(res.hasMore);
          this.isLoading.set(false);
          this.isLoadingMore.set(false);
        },
        error: () => {
          this.errorMessage.set('Could not load the feed. Please try again.');
          this.isLoading.set(false);
          this.isLoadingMore.set(false);
        },
      });
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadFeed(false);
  }

  onReact(event: { postId: number; reactionType: FeedReactionType | null }): void {
    const { postId, reactionType } = event;
    const previousPosts = this.posts();
  
    const action$ =
      reactionType === null
        ? this.feedService.removeReaction(postId)
        : this.feedService.react(postId, reactionType);
  
    (action$ as Observable<ReactToPostResponse | RemoveReactionResponse>).subscribe({
      next: (res) => {
        this.posts.set(
          this.posts().map((p) =>
            p.id === postId ? { ...p, reactions: res.reactions, myReaction: reactionType } : p
          )
        );
      },
      error: () => {
        this.posts.set(previousPosts);
      },
    });
  }
}
