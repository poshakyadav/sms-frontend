// features/school/students/history/student-history-stats-card/student-history-stats-card.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StudentStatsData {
  totalYearsEnrolled?: number;
  workingDays?: number;
  presentDays?: number;
  absentDays?: number;
  attendancePercentage?: number | null;
  totalFeePaidRupees?: number;
  totalExamMarksEntered?: number;
}

@Component({
  selector: 'app-student-history-stats-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stats-card" [class.stats-card--compact]="compact">
      <!-- Attendance -->
      <div class="stat-item">
        <div class="stat-item__icon-wrap stat-item__icon-wrap--teal">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div class="stat-item__body">
          <span class="stat-item__value">
            {{
              stats.attendancePercentage != null
                ? (stats.attendancePercentage | number : '1.0-1') + '%'
                : 'N/A'
            }}
          </span>
          <span class="stat-item__label">Attendance</span>
          @if (!compact && stats.workingDays) {
          <span class="stat-item__sub"
            >{{ stats.presentDays | number }} / {{ stats.workingDays | number }} days</span
          >
          }
        </div>
        @if (!compact && stats.attendancePercentage != null) {
        <div class="stat-item__bar-wrap">
          <div
            class="stat-item__bar stat-item__bar--teal"
            [style.width.%]="stats.attendancePercentage"
          ></div>
        </div>
        }
      </div>

      <!-- Fee Paid -->
      <div class="stat-item">
        <div class="stat-item__icon-wrap stat-item__icon-wrap--green">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div class="stat-item__body">
          <span class="stat-item__value"
            >₹{{ stats.totalFeePaidRupees ?? 0 | number : '1.0-0' }}</span
          >
          <span class="stat-item__label">Total Fee Paid</span>
        </div>
      </div>

      <!-- Exam Marks -->
      <div class="stat-item">
        <div class="stat-item__icon-wrap stat-item__icon-wrap--indigo">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div class="stat-item__body">
          <span class="stat-item__value">{{ stats.totalExamMarksEntered ?? 0 }}</span>
          <span class="stat-item__label">Exam Records</span>
        </div>
      </div>

      <!-- Years Enrolled -->
      <div class="stat-item">
        <div class="stat-item__icon-wrap stat-item__icon-wrap--amber">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <div class="stat-item__body">
          <span class="stat-item__value">{{ stats.totalYearsEnrolled ?? 0 }}</span>
          <span class="stat-item__label">Years Enrolled</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .stats-card {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .stats-card--compact {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      @media (max-width: 640px) {
        .stats-card {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        position: relative;
        overflow: hidden;
      }

      .stat-item__icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .stat-item__icon-wrap--teal {
        background: #f0fdfa;
        color: #14b8a6;
      }
      .stat-item__icon-wrap--green {
        background: #f0fdf4;
        color: #22c55e;
      }
      .stat-item__icon-wrap--indigo {
        background: #eef2ff;
        color: #6366f1;
      }
      .stat-item__icon-wrap--amber {
        background: #fffbeb;
        color: #f59e0b;
      }

      [data-theme='dark'] .stat-item__icon-wrap--teal {
        background: rgba(20, 184, 166, 0.15);
      }
      [data-theme='dark'] .stat-item__icon-wrap--green {
        background: rgba(34, 197, 94, 0.15);
      }
      [data-theme='dark'] .stat-item__icon-wrap--indigo {
        background: rgba(99, 102, 241, 0.15);
      }
      [data-theme='dark'] .stat-item__icon-wrap--amber {
        background: rgba(245, 158, 11, 0.15);
      }

      .stat-item__body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
      }

      .stat-item__value {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-primary);
        line-height: 1.2;
      }

      .stat-item__label {
        font-size: 0.68rem;
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-item__sub {
        font-size: 0.7rem;
        color: var(--color-text-secondary);
        margin-top: 1px;
      }

      .stat-item__bar-wrap {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--color-divider);
      }

      .stat-item__bar {
        height: 100%;
        border-radius: 0 2px 2px 0;
        transition: width 0.6s ease;
        max-width: 100%;
      }
      .stat-item__bar--teal {
        background: #14b8a6;
      }
      .stat-item__bar--green {
        background: #22c55e;
      }
      .stat-item__bar--indigo {
        background: #6366f1;
      }
      .stat-item__bar--amber {
        background: #f59e0b;
      }
    `,
  ],
})
export class StudentHistoryStatsCard {
  @Input({ required: true }) stats!: StudentStatsData;
  @Input() compact = false;
}
