// features/school/students/history/students-history-detail/students-history-detail.ts
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import {
  StudentHistoryService,
  StudentHistoryResponse,
  StudentHistorySummary,
  HistoryEvent,
} from '../../../../../core/services/student-history.service';
import { StudentHistoryEventCard } from '../student-history-event-card/student-history-event-card';
import { StudentHistoryStatsCard } from '../student-history-stats-card/student-history-stats-card';

type EventTypeFilter =
  | 'ALL'
  | 'ENROLLMENT'
  | 'ATTENDANCE'
  | 'FEE'
  | 'EXAM'
  | 'ASSIGNMENT'
  | 'PROFILE';

const EVENT_TYPE_CHIPS: { key: EventTypeFilter; label: string; icon: string }[] = [
  { key: 'ALL', label: 'All Events', icon: '📌' },
  { key: 'ENROLLMENT', label: 'Enrollment', icon: '📋' },
  { key: 'ATTENDANCE', label: 'Attendance', icon: '📅' },
  { key: 'FEE', label: 'Fees', icon: '💳' },
  { key: 'EXAM', label: 'Exams', icon: '📝' },
  { key: 'ASSIGNMENT', label: 'Assignments', icon: '📤' },
  { key: 'PROFILE', label: 'Profile', icon: '👤' },
];

@Component({
  selector: 'app-students-history-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    StudentHistoryEventCard,
    StudentHistoryStatsCard,
  ],
  template: `
    <div class="page-wrapper">
      <!-- Back + Header skeleton -->
      @if (loadingSummary()) {
      <div class="skeleton-header">
        <div class="skeleton skeleton--round" style="width:36px;height:36px"></div>
        <div style="display:flex;flex-direction:column;gap:6px;flex:1">
          <div class="skeleton" style="width:220px;height:20px"></div>
          <div class="skeleton" style="width:140px;height:14px"></div>
        </div>
      </div>
      } @else if (summary()) {
      <!-- ── Student Header ──────────────────────────────────── -->
      <div class="student-header">
        <button class="back-btn" (click)="goBack()">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div class="student-header__card section-card">
          <div class="student-header__main">
            <div class="student-avatar-lg">{{ getInitials(summary()!.student.name) }}</div>
            <div class="student-header__info">
              <div class="student-header__name-row">
                <h2>{{ summary()!.student.name }}</h2>
                @if (summary()!.student.isDeparted) {
                <span class="alumni-badge">Alumni</span>
                } @else {
                <span class="active-badge">Active</span>
                }
              </div>
              <div class="student-header__meta">
                @if (summary()!.currentEnrollment) {
                <span class="meta-pill meta-pill--blue">
                  {{ summary()!.currentEnrollment!.className }}
                  {{ summary()!.currentEnrollment!.sectionName }}
                </span>
                <span class="meta-pill">{{ summary()!.currentEnrollment!.academicYearName }}</span>
                } @if (summary()!.student.admissionNumber) {
                <span class="meta-pill">Adm: {{ summary()!.student.admissionNumber }}</span>
                } @if (summary()!.student.pen) {
                <span class="meta-pill">PEN: {{ summary()!.student.pen }}</span>
                } @if (summary()!.student.apaarId) {
                <span class="meta-pill">APAAR: {{ summary()!.student.apaarId }}</span>
                }
              </div>
              <div class="student-header__contacts">
                @if (summary()!.student.phone) {
                <span class="contact-item">📞 {{ summary()!.student.phone }}</span>
                }
                @if (summary()!.student.email) {
                <span class="contact-item">✉ {{ summary()!.student.email }}</span>
                }
                <span class="contact-item">🔑 {{ summary()!.student.username }}</span>
                @if (summary()!.student.fatherName) {
                <span class="contact-item">👨 {{ summary()!.student.fatherName }}</span>
                }
              </div>
            </div>
          </div>

          <!-- Summary Stats -->
          <div class="student-header__stats">
            <app-student-history-stats-card
              [stats]="summary()!.stats"
            ></app-student-history-stats-card>
          </div>
        </div>
      </div>
      }

      <!-- ── Tabs ─────────────────────────────────────────────── -->
      @if (!loadingSummary() && summary()) {
      <div class="section-card detail-tabs-card">
        <mat-tab-group animationDuration="200ms" dynamicHeight>
          <!-- TAB 1: Event Timeline -->
          <mat-tab>
            <ng-template mat-tab-label>
              📌 <span style="margin-left:6px">Timeline</span>
            </ng-template>

            <div class="tab-body">
              <!-- Filters -->
              <div class="timeline-filters">
                <div class="event-type-chips">
                  @for (chip of eventTypeChips; track chip.key) {
                  <button
                    class="event-chip"
                    [class.active]="activeEventType() === chip.key"
                    (click)="setEventType(chip.key)"
                  >
                    <span>{{ chip.icon }}</span> {{ chip.label }}
                  </button>
                  }
                </div>
                <div class="timeline-date-filters">
                  <input
                    class="date-input"
                    type="date"
                    [(ngModel)]="dateFrom"
                    (change)="loadTimeline()"
                    placeholder="From"
                  />
                  <span class="date-sep">—</span>
                  <input
                    class="date-input"
                    type="date"
                    [(ngModel)]="dateTo"
                    (change)="loadTimeline()"
                    placeholder="To"
                  />
                  @if (dateFrom || dateTo) {
                  <button class="clear-dates-btn" (click)="clearDates()">Clear</button>
                  }
                </div>
              </div>

              <!-- Events -->
              @if (loadingTimeline()) {
              <div class="loading-overlay">
                <mat-spinner diameter="36"></mat-spinner>
                <p>Loading events…</p>
              </div>
              } @else if (events().length === 0) {
              <div class="empty-state">
                <div class="empty-state__icon">📭</div>
                <p>No events found for the selected filters.</p>
              </div>
              } @else {
              <div class="timeline-list">
                @for (event of events(); track event.id; let last = $last) {
                <app-student-history-event-card
                  [event]="event"
                  [isLast]="last"
                ></app-student-history-event-card>
                }
              </div>

              <!-- Timeline Pagination -->
              @if (timelinePagination().totalPages > 1) {
              <div class="timeline-pagination">
                <button
                  class="pag-btn"
                  [disabled]="timelinePage() === 1"
                  (click)="changeTimelinePage(timelinePage() - 1)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span>Page {{ timelinePage() }} of {{ timelinePagination().totalPages }}</span>
                <button
                  class="pag-btn"
                  [disabled]="timelinePage() >= timelinePagination().totalPages"
                  (click)="changeTimelinePage(timelinePage() + 1)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
              } }
            </div>
          </mat-tab>

          <!-- TAB 2: Attendance Summary -->
          <mat-tab>
            <ng-template mat-tab-label>📅 Attendance</ng-template>
            <div class="tab-body">
              @if (!historyData()?.attendanceSummaries?.length) {
              <div class="empty-state">
                <div class="empty-state__icon">📅</div>
                <p>No attendance records found.</p>
              </div>
              } @else { @for (att of historyData()!.attendanceSummaries; track att.academicYearId) {
              <div class="att-year-card">
                <div class="att-year-header">
                  <span class="att-year-name">{{ att.academicYearName }}</span>
                  <span class="att-class-label">{{ att.className }} — {{ att.sectionName }}</span>
                  <span class="att-pct-badge" [class]="getAttClass(att.attendancePercentage)">
                    {{ att.attendancePercentage | number : '1.0-1' }}%
                  </span>
                </div>
                <div class="att-progress-bar">
                  <div
                    class="att-progress-fill"
                    [class]="getAttClass(att.attendancePercentage)"
                    [style.width.%]="att.attendancePercentage"
                  ></div>
                </div>
                <div class="att-stats-row">
                  <div class="att-stat">
                    <span class="att-stat__val">{{ att.totalWorkingDays }}</span>
                    <span class="att-stat__lbl">Working Days</span>
                  </div>
                  <div class="att-stat att-stat--green">
                    <span class="att-stat__val">{{ att.presentDays }}</span>
                    <span class="att-stat__lbl">Present</span>
                  </div>
                  <div class="att-stat att-stat--red">
                    <span class="att-stat__val">{{ att.absentDays }}</span>
                    <span class="att-stat__lbl">Absent</span>
                  </div>
                  <div class="att-stat att-stat--amber">
                    <span class="att-stat__val">{{ att.lateDays }}</span>
                    <span class="att-stat__lbl">Late</span>
                  </div>
                  <div class="att-stat">
                    <span class="att-stat__val">{{ att.halfDays }}</span>
                    <span class="att-stat__lbl">Half Days</span>
                  </div>
                </div>
              </div>
              } }
            </div>
          </mat-tab>

          <!-- TAB 3: Academic Performance -->
          <mat-tab>
            <ng-template mat-tab-label>📝 Academics</ng-template>
            <div class="tab-body">
              @if (!historyData()?.academicPerformance?.length) {
              <div class="empty-state">
                <div class="empty-state__icon">📝</div>
                <p>No exam records found.</p>
              </div>
              } @else { @for (yr of historyData()!.academicPerformance; track yr.academicYearId) {
              <div class="perf-year-section">
                <div class="perf-year-header">
                  <span class="perf-year-label">{{ yr.academicYearName }}</span>
                  <span class="perf-class-label">{{ yr.className }} — {{ yr.sectionName }}</span>
                </div>
                @for (exam of yr.exams; track exam.examId) {
                <div class="exam-card">
                  <div class="exam-card__header">
                    <div>
                      <span class="exam-name">{{ exam.examName }}</span>
                      <span class="exam-type-chip">{{ exam.examType }}</span>
                    </div>
                    <div class="exam-total">
                      <span class="exam-score">{{ exam.totalMarks }}/{{ exam.totalMaxMarks }}</span>
                      <span class="exam-pct" [class]="getAttClass(exam.percentage)"
                        >{{ exam.percentage | number : '1.0-1' }}%</span
                      >
                    </div>
                  </div>
                  <div class="subject-grid">
                    @for (sub of exam.subjectResults; track sub.subjectName) {
                    <div class="subject-item">
                      <span class="subject-name">{{ sub.subjectName }}</span>
                      <span class="subject-marks">{{ sub.marksObtained }}/{{ sub.maxMarks }}</span>
                      @if (sub.grade) {
                      <span class="subject-grade">{{ sub.grade }}</span>
                      }
                    </div>
                    }
                  </div>
                </div>
                }
              </div>
              } }
            </div>
          </mat-tab>

          <!-- TAB 4: Fee Summary -->
          <mat-tab>
            <ng-template mat-tab-label>💳 Fees</ng-template>
            <div class="tab-body">
              @if (!historyData()?.feeSummaries?.length) {
              <div class="empty-state">
                <div class="empty-state__icon">💳</div>
                <p>No fee records found.</p>
              </div>
              } @else { @for (fee of historyData()!.feeSummaries; track fee.academicYearId) {
              <div class="fee-year-card">
                <div class="fee-year-header">
                  <span class="fee-year-label">{{ fee.academicYearName }}</span>
                  <span
                    class="fee-status-badge"
                    [class.paid]="fee.balance === 0"
                    [class.partial]="fee.balance > 0 && fee.totalPaid > 0"
                    [class.overdue]="fee.totalPaid === 0 && fee.totalCharged > 0"
                  >
                    {{ fee.balance === 0 ? 'Paid' : fee.totalPaid > 0 ? 'Partial' : 'Overdue' }}
                  </span>
                </div>
                <div class="fee-row-grid">
                  <div class="fee-item">
                    <span class="fee-item__label">Charged</span>
                    <span class="fee-item__val"
                      >₹{{ fee.totalCharged / 100 | number : '1.0-0' }}</span
                    >
                  </div>
                  <div class="fee-item fee-item--green">
                    <span class="fee-item__label">Paid</span>
                    <span class="fee-item__val">₹{{ fee.totalPaid / 100 | number : '1.0-0' }}</span>
                  </div>
                  <div class="fee-item fee-item--purple">
                    <span class="fee-item__label">Concession</span>
                    <span class="fee-item__val"
                      >₹{{ fee.totalConcession / 100 | number : '1.0-0' }}</span
                    >
                  </div>
                  <div class="fee-item" [class.fee-item--red]="fee.balance > 0">
                    <span class="fee-item__label">Balance</span>
                    <span class="fee-item__val">₹{{ fee.balance / 100 | number : '1.0-0' }}</span>
                  </div>
                </div>
                @if (fee.totalCharged > 0) {
                <div class="fee-progress-wrap">
                  <div class="fee-progress-bar">
                    <div
                      class="fee-progress-fill"
                      [style.width.%]="(fee.totalPaid / fee.totalCharged) * 100"
                    ></div>
                  </div>
                  <span class="fee-progress-label">
                    {{ (fee.totalPaid / fee.totalCharged) * 100 | number : '1.0-0' }}% paid
                  </span>
                </div>
                }
              </div>
              } }
            </div>
          </mat-tab>

          <!-- TAB 5: Enrollment History -->
          <mat-tab>
            <ng-template mat-tab-label>📋 Enrollments</ng-template>
            <div class="tab-body">
              @if (!summary()!.enrollmentHistory.length) {
              <div class="empty-state">
                <div class="empty-state__icon">📋</div>
                <p>No enrollment records found.</p>
              </div>
              } @else {
              <div class="enrollment-timeline">
                @for (enr of summary()!.enrollmentHistory; track enr.academicYearName; let i =
                $index) {
                <div class="enr-item">
                  <div class="enr-item__dot" [class.active]="enr.isActive"></div>
                  <div class="enr-item__body">
                    <div class="enr-item__header">
                      <span class="enr-year">{{ enr.academicYearName }}</span>
                      <span class="enr-class-badge"
                        >{{ enr.className }} — {{ enr.sectionName }}</span
                      >
                      @if (enr.isActive) {
                      <span class="status-chip status-chip--success">Current</span>
                      } @else {
                      <span class="status-chip status-chip--muted">Completed</span>
                      }
                    </div>
                    <div class="enr-item__meta">
                      @if (enr.rollNumber) { <span>Roll: {{ enr.rollNumber }}</span> } @if
                      (enr.enrollmentDate) {
                      <span>Enrolled: {{ enr.enrollmentDate | date : 'dd MMM yyyy' }}</span> } @if
                      (enr.unenrolledAt) {
                      <span>Left: {{ enr.unenrolledAt | date : 'dd MMM yyyy' }}</span> } @if
                      (enr.unenrollmentType) {
                      <span class="enr-reason">{{ enr.unenrollmentType }}</span> }
                    </div>
                    @if (enr.unenrollmentReason) {
                    <div class="enr-reason-text">Reason: {{ enr.unenrollmentReason }}</div>
                    }
                  </div>
                </div>
                }
              </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .skeleton-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px;
        margin-bottom: 16px;
      }

      .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
        margin-bottom: 14px;
        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
      }

      .student-header {
        margin-bottom: 20px;
      }

      .student-header__card {
        padding: 20px;
      }

      .student-header__main {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
      }

      .student-avatar-lg {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
        color: var(--color-primary);
        font-size: 1rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
      }

      .student-header__info {
        flex: 1;
        min-width: 0;
      }

      .student-header__name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 8px;

        h2 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
      }

      .alumni-badge {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 100px;
        background: color-mix(in srgb, var(--color-warning) 14%, transparent);
        color: color-mix(in srgb, var(--color-warning) 70%, #000);
        border: 1px solid color-mix(in srgb, var(--color-warning) 25%, transparent);
      }

      .active-badge {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 100px;
        background: color-mix(in srgb, var(--color-success) 12%, transparent);
        color: color-mix(in srgb, var(--color-success) 70%, #000);
        border: 1px solid color-mix(in srgb, var(--color-success) 22%, transparent);
      }

      .student-header__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }

      .meta-pill {
        display: inline-block;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: 100px;
        background: var(--color-hover);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }
      .meta-pill--blue {
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: var(--color-primary);
        border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
      }

      .student-header__contacts {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .contact-item {
        font-size: 0.78rem;
        color: var(--color-text-secondary);
      }

      .student-header__stats {
        padding-top: 4px;
      }

      /* Tabs */
      .detail-tabs-card {
        overflow: hidden;
      }

      .tab-body {
        padding: 20px;
      }

      /* Timeline */
      .timeline-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-divider);
      }

      .event-type-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .event-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        border-radius: 100px;
        border: 1.5px solid var(--color-border);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
        white-space: nowrap;

        &.active {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        }
        &:hover:not(.active) {
          background: var(--color-hover);
        }
      }

      .timeline-date-filters {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-left: auto;
      }

      .date-input {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 6px 10px;
        font-size: 0.82rem;
        font-family: inherit;
        color: var(--color-text-primary);
        background: var(--color-bg-card);
        outline: none;
        &:focus {
          border-color: var(--color-primary);
        }
      }

      .date-sep {
        color: var(--color-text-muted);
        font-size: 0.84rem;
      }

      .clear-dates-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--color-error);
        font-family: inherit;
        &:hover {
          text-decoration: underline;
        }
      }

      .timeline-list {
        display: flex;
        flex-direction: column;
      }

      .timeline-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--color-divider);
        margin-top: 8px;
        font-size: 0.84rem;
        color: var(--color-text-secondary);
      }

      .pag-btn {
        width: 30px;
        height: 30px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        &:hover:not([disabled]) {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        &[disabled] {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      /* Attendance tab */
      .att-year-card {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 16px;
        margin-bottom: 14px;
        background: var(--color-bg-card);
      }

      .att-year-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .att-year-name {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .att-class-label {
        font-size: 0.8rem;
        color: var(--color-text-secondary);
      }

      .att-pct-badge {
        margin-left: auto;
        font-size: 0.9rem;
        font-weight: 700;
        padding: 2px 10px;
        border-radius: 100px;
        border: 1px solid;
      }
      .att-pct-badge.good {
        color: var(--color-success);
        border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
        background: color-mix(in srgb, var(--color-success) 8%, transparent);
      }
      .att-pct-badge.warn {
        color: var(--color-warning);
        border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      }
      .att-pct-badge.poor {
        color: var(--color-error);
        border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
        background: color-mix(in srgb, var(--color-error) 8%, transparent);
      }

      .att-progress-bar {
        height: 6px;
        background: var(--color-divider);
        border-radius: 3px;
        margin-bottom: 14px;
        overflow: hidden;
      }
      .att-progress-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.5s ease;
      }
      .att-progress-fill.good {
        background: var(--color-success);
      }
      .att-progress-fill.warn {
        background: var(--color-warning);
      }
      .att-progress-fill.poor {
        background: var(--color-error);
      }

      .att-stats-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .att-stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 70px;
      }
      .att-stat__val {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .att-stat__lbl {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }
      .att-stat--green .att-stat__val {
        color: var(--color-success);
      }
      .att-stat--red .att-stat__val {
        color: var(--color-error);
      }
      .att-stat--amber .att-stat__val {
        color: var(--color-warning);
      }

      /* Academic Performance tab */
      .perf-year-section {
        margin-bottom: 24px;
      }
      .perf-year-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-divider);
      }
      .perf-year-label {
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .perf-class-label {
        font-size: 0.78rem;
        color: var(--color-text-secondary);
      }

      .exam-card {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 14px;
        margin-bottom: 10px;
        background: var(--color-bg-card);
      }
      .exam-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
      }
      .exam-name {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-right: 8px;
      }
      .exam-type-chip {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 1px 7px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--color-info) 12%, transparent);
        color: var(--color-info);
      }
      .exam-total {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .exam-score {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .exam-pct {
        font-size: 0.84rem;
        font-weight: 700;
      }
      .exam-pct.good {
        color: var(--color-success);
      }
      .exam-pct.warn {
        color: var(--color-warning);
      }
      .exam-pct.poor {
        color: var(--color-error);
      }

      .subject-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
      }
      .subject-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        background: var(--color-hover);
        font-size: 0.8rem;
      }
      .subject-name {
        flex: 1;
        color: var(--color-text-secondary);
      }
      .subject-marks {
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .subject-grade {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        color: var(--color-primary);
      }

      /* Fee tab */
      .fee-year-card {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 16px;
        margin-bottom: 14px;
        background: var(--color-bg-card);
      }
      .fee-year-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .fee-year-label {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-text-primary);
        flex: 1;
      }
      .fee-status-badge {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 10px;
        border-radius: 100px;
        border: 1px solid;
      }
      .fee-status-badge.paid {
        color: var(--color-success);
        border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
        background: color-mix(in srgb, var(--color-success) 8%, transparent);
      }
      .fee-status-badge.partial {
        color: var(--color-warning);
        border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      }
      .fee-status-badge.overdue {
        color: var(--color-error);
        border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
        background: color-mix(in srgb, var(--color-error) 8%, transparent);
      }

      .fee-row-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 12px;
      }
      @media (max-width: 600px) {
        .fee-row-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      .fee-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--color-hover);
      }
      .fee-item__label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }
      .fee-item__val {
        font-size: 1rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .fee-item--green .fee-item__val {
        color: var(--color-success);
      }
      .fee-item--purple .fee-item__val {
        color: var(--color-secondary);
      }
      .fee-item--red .fee-item__val {
        color: var(--color-error);
      }

      .fee-progress-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .fee-progress-bar {
        flex: 1;
        height: 6px;
        background: var(--color-divider);
        border-radius: 3px;
        overflow: hidden;
      }
      .fee-progress-fill {
        height: 100%;
        background: var(--color-success);
        border-radius: 3px;
        transition: width 0.5s;
      }
      .fee-progress-label {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      /* Enrollment timeline */
      .enrollment-timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .enr-item {
        display: flex;
        gap: 14px;
        padding-bottom: 16px;
        position: relative;
      }
      .enr-item__dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2.5px solid var(--color-border);
        background: var(--color-bg-card);
        flex-shrink: 0;
        margin-top: 4px;
        position: relative;
        z-index: 1;
      }
      .enr-item__dot.active {
        border-color: var(--color-success);
        background: var(--color-success);
      }

      .enr-item__body {
        flex: 1;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 12px 14px;
        background: var(--color-bg-card);
      }
      .enr-item__header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }
      .enr-year {
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .enr-class-badge {
        font-size: 0.78rem;
        padding: 1px 8px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: var(--color-primary);
      }
      .enr-item__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 0.78rem;
        color: var(--color-text-muted);
      }
      .enr-reason {
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        padding: 1px 6px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--color-warning) 12%, transparent);
        color: color-mix(in srgb, var(--color-warning) 70%, #000);
      }
      .enr-reason-text {
        font-size: 0.78rem;
        color: var(--color-text-secondary);
        margin-top: 4px;
      }

      /* Empty state */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 20px;
        text-align: center;
        gap: 8px;
        &__icon {
          font-size: 2rem;
        }
        p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }
      }

      .att-pct {
        font-size: 0.84rem;
        font-weight: 700;
      }
      .att-pct.good {
        color: var(--color-success);
      }
      .att-pct.warn {
        color: var(--color-warning);
      }
      .att-pct.poor {
        color: var(--color-error);
      }
    `,
  ],
})
export class StudentsHistoryDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private historyService = inject(StudentHistoryService);

  private studentId!: number;

  summary = signal<StudentHistorySummary | null>(null);
  historyData = signal<StudentHistoryResponse | null>(null);
  events = signal<HistoryEvent[]>([]);
  loadingSummary = signal(true);
  loadingTimeline = signal(false);

  activeEventType = signal<EventTypeFilter>('ALL');
  timelinePage = signal(1);
  timelinePagination = signal({ totalEvents: 0, totalPages: 1, page: 1, limit: 50 });

  dateFrom = '';
  dateTo = '';

  eventTypeChips = EVENT_TYPE_CHIPS;

  constructor() { }

  ngOnInit() {
    this.studentId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSummary();
    this.loadTimeline();
  }

  loadSummary() {
    this.loadingSummary.set(true);
    this.historyService.getStudentHistorySummary(this.studentId).subscribe({
      next: (res) => {
        this.summary.set(res.summary);
        this.loadingSummary.set(false);
      },
      error: () => this.loadingSummary.set(false),
    });
  }

  loadTimeline() {
    this.loadingTimeline.set(true);
    const eventType = this.activeEventType() !== 'ALL' ? this.activeEventType() : undefined;
    this.historyService
      .getStudentHistory(this.studentId, {
        eventType,
        dateFrom: this.dateFrom || undefined,
        dateTo: this.dateTo || undefined,
        page: this.timelinePage(),
        limit: 50,
      })
      .subscribe({
        next: (res) => {
          this.historyData.set(res);
          this.events.set(res.events ?? []);
          this.timelinePagination.set(res.pagination);
          this.loadingTimeline.set(false);
        },
        error: () => this.loadingTimeline.set(false),
      });
  }

  setEventType(t: EventTypeFilter) {
    this.activeEventType.set(t);
    this.timelinePage.set(1);
    this.loadTimeline();
  }

  changeTimelinePage(p: number) {
    this.timelinePage.set(p);
    this.loadTimeline();
  }

  clearDates() {
    this.dateFrom = '';
    this.dateTo = '';
    this.loadTimeline();
  }

  goBack() {
    this.router.navigate(['/school/students/history']);
  }

  getInitials(name: string) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getAttClass(pct: number): string {
    return pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'poor';
  }
}
