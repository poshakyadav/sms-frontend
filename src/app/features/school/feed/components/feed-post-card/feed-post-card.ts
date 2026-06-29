// features/school/feed/components/feed-post-card/feed-post-card.ts

import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedPost, FeedReactionType } from '../../models/feed.models';
import { FeedReactionBar } from '../feed-reaction-bar/feed-reaction-bar';

@Component({
  selector: 'app-feed-post-card',
  standalone: true,
  imports: [CommonModule, FeedReactionBar],
  templateUrl: './feed-post-card.html',
  styleUrl: './feed-post-card.scss',
})
export class FeedPostCard {
  post = input.required<FeedPost>();

  /** Whether the viewer can manage posts (edit/delete/pin) — admin view only. */
  canManage = input(false);

  react = output<{ postId: number; reactionType: FeedReactionType | null }>();
  edit = output<FeedPost>();
  deletePost = output<FeedPost>();
  togglePin = output<FeedPost>();

  onReact(reactionType: FeedReactionType | null): void {
    this.react.emit({ postId: this.post().id, reactionType });
  }

  /** "CLASS_SECTION_STUDENTS" → "Class Section Students" */
  humanizeAudience(value: string): string {
    return value
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
