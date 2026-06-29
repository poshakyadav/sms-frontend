// features/school/feed/components/feed-target-selector/feed-target-selector.ts

import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AcademicsService, ClassSection } from '../../../../../core/services/academics.service';
import {
  CLASS_SCOPED_AUDIENCES,
  FEED_TARGET_AUDIENCE_OPTIONS,
  FeedTargetAudience,
} from '../../models/feed.models';

export interface FeedTargetValue {
  targetAudience: FeedTargetAudience;
  classSectionId: number | null;
}

@Component({
  selector: 'app-feed-target-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feed-target-selector.html',
  styleUrl: './feed-target-selector.scss',
})
export class FeedTargetSelector {
  // ── Inputs / Outputs (signal-based, standalone component) ─────────────────

  /** Initial value, e.g. when editing an existing post. */
  initialValue = input<FeedTargetValue | null>(null);

  /** Emits whenever a valid, complete targeting selection is made. */
  valueChange = output<FeedTargetValue>();

  // ── Local state ─────────────────────────────────────────────────────────────

  audienceOptions = FEED_TARGET_AUDIENCE_OPTIONS;

  selectedAudience = signal<FeedTargetAudience>('ALL_SCHOOL');
  selectedClassSectionId = signal<number | null>(null);

  classSections = signal<ClassSection[]>([]);
  isLoadingClassSections = signal(false);
  loadError = signal<string | null>(null);

  isClassScoped = computed(() => CLASS_SCOPED_AUDIENCES.has(this.selectedAudience()));

  constructor(private academicsService: AcademicsService) {
    // Apply initial value once, if provided (edit mode).
    effect(() => {
      const initial = this.initialValue();
      if (initial) {
        this.selectedAudience.set(initial.targetAudience);
        this.selectedClassSectionId.set(initial.classSectionId);
      }
    });

    this.loadClassSections();
  }

  onAudienceChange(audience: FeedTargetAudience): void {
    this.selectedAudience.set(audience);

    // Clear classSectionId when switching away from a class-scoped audience —
    // mirrors the backend's superRefine invariant in validators.ts which
    // rejects classSectionId being set for non-class-scoped audiences.
    if (!CLASS_SCOPED_AUDIENCES.has(audience)) {
      this.selectedClassSectionId.set(null);
    }

    this.emitIfValid();
  }

  onClassSectionChange(classSectionId: number | null): void {
    this.selectedClassSectionId.set(classSectionId);
    this.emitIfValid();
  }

  /** Exposed so the parent dialog can check before allowing submit. */
  isValid(): boolean {
    if (this.isClassScoped()) {
      return this.selectedClassSectionId() !== null;
    }
    return true;
  }

  getCurrentValue(): FeedTargetValue {
    return {
      targetAudience: this.selectedAudience(),
      classSectionId: this.isClassScoped() ? this.selectedClassSectionId() : null,
    };
  }

  private emitIfValid(): void {
    if (this.isValid()) {
      this.valueChange.emit(this.getCurrentValue());
    }
  }

  private loadClassSections(): void {
    this.isLoadingClassSections.set(true);
    this.loadError.set(null);

    this.academicsService.getClassSections().subscribe({
      next: (res) => {
        // Only active class-sections make sense as feed targets.
        this.classSections.set(res.classSections.filter((cs) => cs.isActive));
        this.isLoadingClassSections.set(false);
      },
      error: () => {
        this.loadError.set('Could not load class-sections.');
        this.isLoadingClassSections.set(false);
      },
    });
  }
}
