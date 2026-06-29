// features/school/feed/feed-admin-page/feed-admin-page.ts

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { FeedService } from '../services/feed.service';
import { FeedVideoCard } from '../components/feed-video-card/feed-video-card';
import { CreatePostDialog } from '../components/create-post-dialog/create-post-dialog';
import { CreateVideoDialog } from '../components/create-video-dialog/create-video-dialog';
import { FeedPostCard } from '../components/feed-post-card/feed-post-card';
import { FeedPost, FeedReactionType, ReactToPostResponse, RemoveReactionResponse } from '../models/feed.models';

const PAGE_SIZE = 20;

type DialogMode = 'none' | 'post' | 'video';

@Component({
  selector: 'app-feed-admin-page',
  standalone: true,
  imports: [CommonModule, FeedPostCard, FeedVideoCard, CreatePostDialog, CreateVideoDialog],
  templateUrl: './feed-admin-page.html',
  styleUrl: './feed-admin-page.scss',
})
export class FeedAdminPage implements OnInit {
  posts = signal<FeedPost[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  errorMessage = signal<string | null>(null);

  offset = signal(0);
  hasMore = signal(false);

  /** Admin can toggle between "published" view and "drafts" view. */
  showDraftsOnly = signal(false);

  dialogMode = signal<DialogMode>('none');
  editingPost = signal<FeedPost | null>(null);

  /** Track in-flight delete confirmation so we don't double-fire. */
  pendingDelete = signal<FeedPost | null>(null);

  constructor(private feedService: FeedService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadFeed(true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  loadFeed(isInitial: boolean): void {
    if (isInitial) {
      this.isLoading.set(true);
      this.offset.set(0);
    } else {
      this.isLoadingMore.set(true);
    }
    this.errorMessage.set(null);

    this.feedService
      .listFeed({
        limit: PAGE_SIZE,
        offset: isInitial ? 0 : this.offset(),
        // publishedOnly=false → admin requests ALL posts (drafts included).
        // The toggle below filters client-side between "all" and "drafts only"
        // so we don't need two separate server round trips for that switch.
        publishedOnly: false,
      })
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

  get visiblePosts(): FeedPost[] {
    return this.showDraftsOnly() ? this.posts().filter((p) => !p.isPublished) : this.posts();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOG MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  openCreatePost(): void {
    this.editingPost.set(null);
    this.dialogMode.set('post');
  }

  openCreateVideo(): void {
    this.editingPost.set(null);
    this.dialogMode.set('video');
  }

  openEdit(post: FeedPost): void {
    this.editingPost.set(post);
    this.dialogMode.set(post.contentType === 'VIDEO' ? 'video' : 'post');
  }

  closeDialog(): void {
    this.dialogMode.set('none');
    this.editingPost.set(null);
  }

  onSaved(post: FeedPost): void {
    const existingIndex = this.posts().findIndex((p) => p.id === post.id);

    if (existingIndex >= 0) {
      // Update in place.
      this.posts.set(this.posts().map((p) => (p.id === post.id ? post : p)));
    } else {
      // New post — prepend (newest first), matching backend's default sort.
      this.posts.set([post, ...this.posts()]);
    }

    this.closeDialog();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGE ACTIONS — pin / delete
  // ═══════════════════════════════════════════════════════════════════════════

  async onTogglePin(post: FeedPost): Promise<void> {
    try {
      const res = await firstValueFrom(this.feedService.togglePin(post.id, !post.isPinned));

      // Pinning a post unpins all others server-side — reflect that locally
      // too, rather than refetching the whole list.
      this.posts.set(
        this.posts().map((p) => {
          if (p.id === res.post.id) return res.post;
          if (res.post.isPinned && p.isPinned) return { ...p, isPinned: false };
          return p;
        })
      );

      this.toast.success(res.post.isPinned ? 'Post pinned.' : 'Post unpinned.');
    } catch (err: any) {
      this.toast.error(err?.error?.error || 'Failed to update pin status.');
    }
  }

  confirmDelete(post: FeedPost): void {
    this.pendingDelete.set(post);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async onDelete(post: FeedPost): Promise<void> {
    try {
      await firstValueFrom(this.feedService.deletePost(post.id));
      this.posts.set(this.posts().filter((p) => p.id !== post.id));
      this.toast.success('Post deleted.');
    } catch (err: any) {
      this.toast.error(err?.error?.error || 'Failed to delete post.');
    } finally {
      this.pendingDelete.set(null);
    }
  }

  // Reactions are also visible/usable from the admin view (the owner can
  // react too — backend's canViewFeed() allows anyone with manage rights).
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
