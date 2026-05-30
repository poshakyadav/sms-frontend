// features/school/students/history/student-history-event-card/student-history-event-card.ts
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryEvent } from '../../../../../core/services/student-history.service';

@Component({
  selector: 'app-student-history-event-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="event-card" [class]="'event-card--' + eventConfig().color" (click)="toggleExpand()">
      <div class="event-card__icon-col">
        <div class="event-card__icon-ring">
          <span class="event-card__icon">{{ eventConfig().icon }}</span>
        </div>
        <div class="event-card__connector"></div>
      </div>

      <div class="event-card__body">
        <div class="event-card__header">
          <div class="event-card__meta">
            <span class="event-card__type-badge">{{ eventConfig().label }}</span>
            <time class="event-card__date">{{ event.date | date : 'd MMM yyyy' }}</time>
          </div>
          <button class="event-card__expand-btn" [class.rotated]="expanded()">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <h4 class="event-card__title">{{ event.title }}</h4>
        <p class="event-card__description">{{ event.description }}</p>

        @if (event.classSection) {
        <div class="event-card__context-chips">
          <span class="chip chip--class">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            {{ event.classSection.className }} — {{ event.classSection.sectionName }}
          </span>
          @if (event.academicYear) {
          <span class="chip chip--year">{{ event.academicYear.name }}</span>
          }
        </div>
        } @if (expanded()) {
        <div class="event-card__metadata" @expandIn>
          <div class="metadata-grid">
            @for (entry of metadataEntries(); track entry.key) { @if (entry.value !== null &&
            entry.value !== undefined && entry.value !== '') {
            <div class="metadata-item">
              <span class="metadata-key">{{ entry.key }}</span>
              <span class="metadata-value">{{ entry.value }}</span>
            </div>
            } }
          </div>
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .event-card {
        display: flex;
        gap: 0;
        position: relative;
        cursor: pointer;
      }

      .event-card__icon-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;
        width: 44px;
      }

      .event-card__icon-ring {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        border: 2px solid;
        flex-shrink: 0;
        transition: transform 0.2s ease;
        background: var(--surface);
      }

      .event-card:hover .event-card__icon-ring {
        transform: scale(1.08);
      }

      .event-card__connector {
        flex: 1;
        width: 2px;
        min-height: 12px;
        background: var(--border);
        margin-top: 4px;
      }

      /* Color variants */
      .event-card--blue .event-card__icon-ring {
        border-color: #3b82f6;
        color: #3b82f6;
        background: #eff6ff;
      }
      .event-card--green .event-card__icon-ring {
        border-color: #22c55e;
        color: #22c55e;
        background: #f0fdf4;
      }
      .event-card--red .event-card__icon-ring {
        border-color: #ef4444;
        color: #ef4444;
        background: #fef2f2;
      }
      .event-card--amber .event-card__icon-ring {
        border-color: #f59e0b;
        color: #f59e0b;
        background: #fffbeb;
      }
      .event-card--purple .event-card__icon-ring {
        border-color: #a855f7;
        color: #a855f7;
        background: #faf5ff;
      }
      .event-card--teal .event-card__icon-ring {
        border-color: #14b8a6;
        color: #14b8a6;
        background: #f0fdfa;
      }
      .event-card--slate .event-card__icon-ring {
        border-color: #64748b;
        color: #64748b;
        background: #f8fafc;
      }
      .event-card--rose .event-card__icon-ring {
        border-color: #f43f5e;
        color: #f43f5e;
        background: #fff1f2;
      }
      .event-card--indigo .event-card__icon-ring {
        border-color: #6366f1;
        color: #6366f1;
        background: #eef2ff;
      }

      .event-card__body {
        flex: 1;
        padding: 0 0 20px 12px;
      }

      .event-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .event-card__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .event-card__type-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 100px;
        background: var(--surface-alt, #f1f5f9);
        color: var(--text-secondary, #64748b);
      }

      .event-card__date {
        font-size: 12px;
        color: var(--text-muted, #94a3b8);
        font-variant-numeric: tabular-nums;
      }

      .event-card__expand-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted, #94a3b8);
        padding: 2px;
        display: flex;
        align-items: center;
        transition: color 0.15s;
        flex-shrink: 0;
      }
      .event-card__expand-btn svg {
        transition: transform 0.2s ease;
      }
      .event-card__expand-btn.rotated svg {
        transform: rotate(180deg);
      }
      .event-card__expand-btn:hover {
        color: var(--text-primary, #1e293b);
      }

      .event-card__title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #1e293b);
        margin: 0 0 4px;
        line-height: 1.4;
      }

      .event-card__description {
        font-size: 13px;
        color: var(--text-secondary, #64748b);
        margin: 0 0 8px;
        line-height: 1.5;
      }

      .event-card__context-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
        padding: 3px 8px;
        border-radius: 100px;
        border: 1px solid;
      }
      .chip--class {
        border-color: #c7d2fe;
        color: #4f46e5;
        background: #eef2ff;
      }
      .chip--year {
        border-color: #bbf7d0;
        color: #15803d;
        background: #f0fdf4;
      }

      .event-card__metadata {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--surface-alt, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
      }

      .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 6px 16px;
      }

      .metadata-item {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .metadata-key {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted, #94a3b8);
      }

      .metadata-value {
        font-size: 12px;
        color: var(--text-primary, #1e293b);
        word-break: break-word;
      }
    `,
  ],
})
export class StudentHistoryEventCard {
  @Input({ required: true }) event!: HistoryEvent;
  @Input() isLast = false;

  expanded = signal(false);

  toggleExpand() {
    this.expanded.update((v) => !v);
  }

  eventConfig() {
    const configs: Record<string, { icon: string; color: string; label: string }> = {
      ENROLLED: { icon: '📋', color: 'blue', label: 'Enrollment' },
      UNENROLLED: { icon: '🚪', color: 'red', label: 'Unenrolled' },
      TRANSFERRED: { icon: '🔄', color: 'amber', label: 'Transfer' },
      ATTENDANCE_MARKED: { icon: '📅', color: 'teal', label: 'Attendance' },
      FEE_PAYMENT: { icon: '💳', color: 'green', label: 'Fee Paid' },
      FEE_CONCESSION: { icon: '🏷️', color: 'purple', label: 'Concession' },
      FEE_ASSIGNMENT: { icon: '📄', color: 'indigo', label: 'Fee Assigned' },
      EXAM_MARKS: { icon: '📝', color: 'indigo', label: 'Exam Marks' },
      ASSIGNMENT_SUBMISSION: { icon: '📤', color: 'amber', label: 'Assignment' },
      ASSIGNMENT_GRADED: { icon: '⭐', color: 'purple', label: 'Graded' },
      ACCOUNT_CREATED: { icon: '👤', color: 'slate', label: 'Account' },
      PARENT_LINKED: { icon: '👨‍👩‍👦', color: 'rose', label: 'Parent Linked' },
    };
    return (
      configs[this.event.eventType] ?? { icon: '📌', color: 'slate', label: this.event.eventType }
    );
  }

  metadataEntries() {
    return Object.entries(this.event.metadata ?? {}).map(([key, value]) => ({
      key: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      value: value === true ? 'Yes' : value === false ? 'No' : String(value ?? ''),
    }));
  }
}
