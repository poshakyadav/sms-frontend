// features/school/students/udise/udise-completeness-badge/udise-completeness-badge.ts
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UDISECompleteness } from '../../../../../core/services/student-udise.service';

@Component({
  selector: 'app-udise-completeness-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="completeness-badge" [class]="sizeClass()" (click)="toggleExpand()">
      <!-- Ring gauge -->
      <div class="ring-wrap" [class]="ringColorClass()">
        <svg class="ring-svg" viewBox="0 0 36 36">
          <path
            class="ring-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke-width="3"
          />
          <path
            class="ring-fill"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke-width="3"
            [style.strokeDasharray]="dashArray()"
          />
        </svg>
        <span class="ring-label">{{ completeness.score }}%</span>
      </div>

      @if (showLabel) {
      <div class="badge-text">
        <span class="badge-status">{{ statusLabel() }}</span>
        @if (size !== 'xs') {
        <div class="section-scores">
          <span class="section-score" [class.complete]="completeness.gp.score === 100">
            GP {{ completeness.gp.score }}%
          </span>
          <span class="section-score" [class.complete]="completeness.ep.score === 100">
            EP {{ completeness.ep.score }}%
          </span>
          <span class="section-score" [class.complete]="completeness.sf.score === 100">
            SF {{ completeness.sf.score }}%
          </span>
        </div>
        }
      </div>
      }

      <!-- Expanded missing fields tooltip -->
      @if (expanded()) {
      <div class="missing-popup" (click)="$event.stopPropagation()">
        <div class="missing-popup__header">Missing Fields</div>
        <div class="missing-popup__sections">
          @if (completeness.gp.missing.length > 0) {
          <div class="missing-section">
            <span class="missing-section__label">GP</span>
            <div class="missing-fields">
              @for (f of completeness.gp.missing; track f) {
              <span class="missing-field">{{ f }}</span>
              }
            </div>
          </div>
          } @if (completeness.ep.missing.length > 0) {
          <div class="missing-section">
            <span class="missing-section__label">EP</span>
            <div class="missing-fields">
              @for (f of completeness.ep.missing; track f) {
              <span class="missing-field">{{ f }}</span>
              }
            </div>
          </div>
          } @if (completeness.sf.missing.length > 0) {
          <div class="missing-section">
            <span class="missing-section__label">SF</span>
            <div class="missing-fields">
              @for (f of completeness.sf.missing; track f) {
              <span class="missing-field">{{ f }}</span>
              }
            </div>
          </div>
          } @if (completeness.isComplete) {
          <div class="all-complete-msg">✅ All UDISE fields complete!</div>
          }
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        position: relative;
      }

      .completeness-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        position: relative;
      }

      /* Size variants */
      .completeness-badge.size-xs .ring-wrap {
        width: 32px;
        height: 32px;
      }
      .completeness-badge.size-xs .ring-label {
        font-size: 0.52rem;
      }
      .completeness-badge.size-sm .ring-wrap {
        width: 40px;
        height: 40px;
      }
      .completeness-badge.size-sm .ring-label {
        font-size: 0.6rem;
      }
      .completeness-badge.size-md .ring-wrap {
        width: 56px;
        height: 56px;
      }
      .completeness-badge.size-md .ring-label {
        font-size: 0.72rem;
      }
      .completeness-badge.size-lg .ring-wrap {
        width: 72px;
        height: 72px;
      }
      .completeness-badge.size-lg .ring-label {
        font-size: 0.84rem;
      }

      .ring-wrap {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .ring-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .ring-bg {
        stroke: var(--color-divider);
      }

      .ring-fill {
        stroke-linecap: round;
        transition: stroke-dasharray 0.6s ease;
      }

      /* Color variants */
      .ring-green .ring-fill {
        stroke: #22c55e;
      }
      .ring-yellow .ring-fill {
        stroke: #f59e0b;
      }
      .ring-red .ring-fill {
        stroke: #ef4444;
      }

      .ring-label {
        position: relative;
        font-weight: 700;
        color: var(--color-text-primary);
        z-index: 1;
      }

      .badge-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .badge-status {
        font-size: 0.78rem;
        font-weight: 700;
      }

      .section-scores {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }

      .section-score {
        font-size: 0.68rem;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--color-warning) 10%, transparent);
        color: color-mix(in srgb, var(--color-warning) 70%, #000);
        border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
      }

      .section-score.complete {
        background: color-mix(in srgb, var(--color-success) 10%, transparent);
        color: color-mix(in srgb, var(--color-success) 70%, #000);
        border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
      }

      /* Popup */
      .missing-popup {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        min-width: 240px;
        max-width: 320px;
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 300;
        padding: 12px 14px;
      }

      .missing-popup__header {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
        margin-bottom: 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--color-divider);
      }

      .missing-popup__sections {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .missing-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .missing-section__label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--color-text-muted);
      }

      .missing-fields {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .missing-field {
        font-size: 0.72rem;
        padding: 2px 7px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--color-error) 8%, transparent);
        color: var(--color-error);
        border: 1px solid color-mix(in srgb, var(--color-error) 18%, transparent);
      }

      .all-complete-msg {
        font-size: 0.82rem;
        color: var(--color-success);
        font-weight: 600;
        text-align: center;
        padding: 4px 0;
      }
    `,
  ],
})
export class UdiseCompletenessBadge {
  @Input({ required: true }) completeness!: UDISECompleteness;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'sm';
  @Input() showLabel = true;

  expanded = signal(false);

  toggleExpand() {
    if (!this.completeness.isComplete) this.expanded.update((v) => !v);
  }

  sizeClass() {
    return `size-${this.size}`;
  }

  ringColorClass(): string {
    const s = this.completeness.score;
    if (s >= 80) return 'ring-green';
    if (s >= 50) return 'ring-yellow';
    return 'ring-red';
  }

  statusLabel(): string {
    if (this.completeness.isComplete) return 'Complete';
    if (this.completeness.score >= 50) return 'Partial';
    if (this.completeness.score === 0) return 'Not Started';
    return 'Incomplete';
  }

  dashArray(): string {
    const circumference = 100;
    const filled = (this.completeness.score / 100) * circumference;
    return `${filled} ${circumference - filled}`;
  }
}
