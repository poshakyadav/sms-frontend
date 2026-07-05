// features/school/feed/components/feed-reaction-bar/feed-reaction-bar.ts

import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FEED_REACTION_OPTIONS, FeedReactionType } from '../../models/feed.models';

@Component({
  selector: 'app-feed-reaction-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feed-reaction-bar.html',
  styleUrl: './feed-reaction-bar.scss',
})
export class FeedReactionBar {
  reactions = input.required<Record<string, number>>();
  myReaction = input<FeedReactionType | null>(null);

  /** Emits the reaction the user picked, or null if they removed their reaction. */
  react = output<FeedReactionType | null>();

  options = FEED_REACTION_OPTIONS;

  isPickerOpen = signal(false);

  /** Guards against null/undefined reactions (e.g. an optimistically-added
   *  post that hasn't gone through the API round-trip yet). Public because
   *  the template reads it directly via the keyvalue pipe. */
  reactionsSafe = computed<Record<string, number>>(() => this.reactions() ?? {});

  totalReactions = computed(() =>
    Object.values(this.reactionsSafe()).reduce((sum, count) => sum + count, 0)
  );

  togglePicker(): void {
    this.isPickerOpen.set(!this.isPickerOpen());
  }

  closePicker(): void {
    this.isPickerOpen.set(false);
  }

  pick(reactionType: FeedReactionType): void {
    this.closePicker();

    if (this.myReaction() === reactionType) {
      this.react.emit(null);
    } else {
      this.react.emit(reactionType);
    }
  }

  getEmoji(type: string): string {
    return this.options.find((o) => o.value === type)?.emoji ?? '👍';
  }
}