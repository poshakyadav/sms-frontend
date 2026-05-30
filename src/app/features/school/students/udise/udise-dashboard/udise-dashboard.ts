// features/school/students/udise/udise-dashboard/udise-dashboard.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  StudentUdiseService,
  UDISECompletenessReport,
} from '../../../../../core/services/student-udise.service';
import {
  AcademicsService,
  AcademicYear,
  ClassSection,
} from '../../../../../core/services/academics.service';
import { UdiseCompletenessBadge } from '../udise-completeness-badge/udise-completeness-badge';
import { UdiseExportDialog } from '../udise-export-dialog/udise-export-dialog';

@Component({
  selector: 'app-udise-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    UdiseCompletenessBadge,
    UdiseExportDialog,
  ],
  template: `
    <div class="page-wrapper">
      <!-- Page header -->
      <div class="page-header">
        <div class="page-header__info">
          <h1>UDISE+ Data Management</h1>
          <p>
            Monitor and manage UDISE+ 2025-26 student data completeness for SDMS portal submission
          </p>
        </div>
        <div class="page-header__actions">
          <button
            class="udise-action-btn udise-action-btn--export"
            (click)="showExportDialog.set(true)"
          >
            <mat-icon>download</mat-icon>
            Export Excel
          </button>
        </div>
      </div>

      <!-- Loading state -->
      @if (loading()) {
      <div class="loading-overlay">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading UDISE completeness data…</p>
      </div>
      } @if (!loading() && report()) {
      <!-- Summary stat cards -->
      <div class="stats-grid">
        <button
          class="stat-card stat-card--info"
          (click)="setStatusFilter('all')"
          [class.active]="statusFilter() === 'all'"
        >
          <div class="stat-card__icon icon-primary"><mat-icon>people</mat-icon></div>
          <div class="stat-card__body">
            <span class="stat-card__count">{{ report()!.summary.totalStudents }}</span>
            <span class="stat-card__label">Total Students</span>
          </div>
        </button>

        <button
          class="stat-card"
          (click)="setStatusFilter('complete')"
          [class.active]="statusFilter() === 'complete'"
        >
          <div class="stat-card__icon icon-success"><mat-icon>check_circle</mat-icon></div>
          <div class="stat-card__body">
            <span class="stat-card__count">{{ report()!.summary.fullyComplete }}</span>
            <span class="stat-card__label">Fully Complete</span>
          </div>
        </button>

        <button
          class="stat-card"
          (click)="setStatusFilter('partial')"
          [class.active]="statusFilter() === 'partial'"
        >
          <div class="stat-card__icon icon-warning"><mat-icon>pending</mat-icon></div>
          <div class="stat-card__body">
            <span class="stat-card__count">{{ report()!.summary.partiallyComplete }}</span>
            <span class="stat-card__label">Partial</span>
          </div>
        </button>

        <button
          class="stat-card"
          (click)="setStatusFilter('not_started')"
          [class.active]="statusFilter() === 'not_started'"
        >
          <div class="stat-card__icon icon-error"><mat-icon>radio_button_unchecked</mat-icon></div>
          <div class="stat-card__body">
            <span class="stat-card__count">{{ report()!.summary.notStarted }}</span>
            <span class="stat-card__label">Not Started</span>
          </div>
        </button>

        <div class="stat-card stat-card--info" style="cursor:default">
          <div class="stat-card__icon icon-info"><mat-icon>bar_chart</mat-icon></div>
          <div class="stat-card__body">
            <span class="stat-card__count">{{ report()!.summary.averageScore }}%</span>
            <span class="stat-card__label">Avg Score</span>
          </div>
        </div>
      </div>

      <!-- Section completion mini-bar -->
      <div class="section-card" style="margin-bottom:20px">
        <div class="section-header">
          <mat-icon>segment</mat-icon>
          <span class="section-header__title">Section Completion</span>
        </div>
        <div class="section-body">
          <div class="section-completion-grid">
            <div class="section-completion-item">
              <div class="section-completion-item__top">
                <span class="section-completion-item__label">GP — General Profile</span>
                <span class="section-completion-item__count"
                  >{{ report()!.bySection.gpComplete }} /
                  {{ report()!.summary.totalStudents }}</span
                >
              </div>
              <div class="section-progress-bar">
                <div
                  class="section-progress-bar__fill section-progress-bar__fill--gp"
                  [style.width.%]="
                    getPercent(report()!.bySection.gpComplete, report()!.summary.totalStudents)
                  "
                ></div>
              </div>
              <span class="section-completion-item__pct"
                >{{
                  getPercent(report()!.bySection.gpComplete, report()!.summary.totalStudents)
                }}%</span
              >
            </div>

            <div class="section-completion-item">
              <div class="section-completion-item__top">
                <span class="section-completion-item__label">EP — Enrollment Profile</span>
                <span class="section-completion-item__count"
                  >{{ report()!.bySection.epComplete }} /
                  {{ report()!.summary.totalStudents }}</span
                >
              </div>
              <div class="section-progress-bar">
                <div
                  class="section-progress-bar__fill section-progress-bar__fill--ep"
                  [style.width.%]="
                    getPercent(report()!.bySection.epComplete, report()!.summary.totalStudents)
                  "
                ></div>
              </div>
              <span class="section-completion-item__pct"
                >{{
                  getPercent(report()!.bySection.epComplete, report()!.summary.totalStudents)
                }}%</span
              >
            </div>

            <div class="section-completion-item">
              <div class="section-completion-item__top">
                <span class="section-completion-item__label">SF — Student Facilities</span>
                <span class="section-completion-item__count"
                  >{{ report()!.bySection.sfComplete }} /
                  {{ report()!.summary.totalStudents }}</span
                >
              </div>
              <div class="section-progress-bar">
                <div
                  class="section-progress-bar__fill section-progress-bar__fill--sf"
                  [style.width.%]="
                    getPercent(report()!.bySection.sfComplete, report()!.summary.totalStudents)
                  "
                ></div>
              </div>
              <span class="section-completion-item__pct"
                >{{
                  getPercent(report()!.bySection.sfComplete, report()!.summary.totalStudents)
                }}%</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="udise-filter-bar">
        <div class="udise-search-wrap">
          <mat-icon class="udise-search-icon">search</mat-icon>
          <input
            class="udise-search-input"
            type="text"
            placeholder="Search student name…"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch()"
          />
          @if (searchQuery) {
          <button class="udise-search-clear" (click)="searchQuery = ''; onSearch()">
            <mat-icon>close</mat-icon>
          </button>
          }
        </div>

        <div class="udise-filter-selects">
          <select
            class="udise-filter-select"
            [(ngModel)]="selectedYearId"
            (ngModelChange)="loadReport()"
          >
            <option [value]="null">All Years</option>
            @for (y of academicYears(); track y.id) {
            <option [value]="y.id">{{ y.name }}</option>
            }
          </select>

          <select
            class="udise-filter-select"
            [(ngModel)]="selectedClassSectionId"
            (ngModelChange)="loadReport()"
          >
            <option [value]="null">All Classes</option>
            @for (cs of classSections(); track cs.id) {
            <option [value]="cs.id">{{ cs.className }} – {{ cs.sectionName }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Academic year label -->
      <div class="udise-year-badge">
        <mat-icon>calendar_today</mat-icon>
        Academic Year: <strong>{{ report()!.summary.academicYear || 'Current' }}</strong>
        <span class="tab-badge tab-badge--primary" style="margin-left:4px">{{
          filteredStudents().length
        }}</span>
      </div>

      <!-- Student table -->
      <div class="table-card">
        <div class="overflow-x">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th class="th-align-center">Overall</th>
                <th class="th-align-center">GP</th>
                <th class="th-align-center">EP</th>
                <th class="th-align-center">SF</th>
                <th class="th-align-center">Status</th>
                <th class="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              @if (filteredStudents().length === 0) {
              <tr>
                <td colspan="8">
                  <div class="udise-empty-state">
                    <mat-icon>check_circle_outline</mat-icon>
                    <h3>No students match your filters</h3>
                    <p>Try adjusting the search or filter criteria</p>
                  </div>
                </td>
              </tr>
              } @for (student of filteredStudents(); track student.userId) {
              <tr class="table-row">
                <td>
                  <div class="student-cell">
                    <div
                      class="avatar-initials"
                      [class.avatar-initials--complete]="student.completeness.isComplete"
                    >
                      {{ getInitials(student.name) }}
                    </div>
                    <div class="student-cell-info">
                      <span class="cell-name">{{ student.name }}</span>
                      <span class="cell-sub"
                        >{{ student.className }} {{ student.sectionName }}</span
                      >
                    </div>
                  </div>
                </td>
                <td>
                  <span class="roll-chip">{{ student.className }}-{{ student.sectionName }}</span>
                </td>
                <td class="td-align-center">
                  <app-udise-completeness-badge
                    [completeness]="student.completeness"
                    size="xs"
                    [showLabel]="false"
                  ></app-udise-completeness-badge>
                </td>
                <td class="td-align-center">
                  <span
                    class="udise-section-pill"
                    [class.complete]="student.completeness.gp.score === 100"
                  >
                    {{ student.completeness.gp.score }}%
                  </span>
                </td>
                <td class="td-align-center">
                  <span
                    class="udise-section-pill"
                    [class.complete]="student.completeness.ep.score === 100"
                  >
                    {{ student.completeness.ep.score }}%
                  </span>
                </td>
                <td class="td-align-center">
                  <span
                    class="udise-section-pill"
                    [class.complete]="student.completeness.sf.score === 100"
                  >
                    {{ student.completeness.sf.score }}%
                  </span>
                </td>
                <td class="td-align-center">
                  @if (student.completeness.isComplete) {
                  <span class="status-chip status-chip--success">
                    <mat-icon>check_circle</mat-icon> Complete
                  </span>
                  } @else if (student.completeness.score === 0) {
                  <span class="status-chip status-chip--error">Not Started</span>
                  } @else {
                  <span class="status-chip status-chip--warning">Partial</span>
                  }
                </td>
                <td class="col-action">
                  <button
                    class="udise-edit-btn"
                    [routerLink]="['/school/students/udise', student.userId]"
                    matTooltip="Edit UDISE profile"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      }

      <!-- Export dialog -->
      @if (showExportDialog()) {
      <app-udise-export-dialog
        [preselectedYearId]="selectedYearId ?? undefined"
        [preselectedClassSectionId]="selectedClassSectionId ?? undefined"
        (closed)="showExportDialog.set(false)"
        (exported)="showExportDialog.set(false)"
      ></app-udise-export-dialog>
      }
    </div>
  `,
  styles: [
    `
      /* ── Reuses global shared classes: page-wrapper, page-header,
       stats-grid, stat-card, section-card, section-header, section-body,
       table-card, data-table, status-chip, roll-chip, tab-badge, etc. ── */

      /* ── Action buttons ──────────────────────────────────────────────── */
      .udise-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 18px;
        border-radius: var(--radius-sm);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
        border: 1px solid;
        mat-icon {
          font-size: 18px;
          height: 18px;
          width: 18px;
        }

        &--export {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #fff;
          &:hover {
            opacity: 0.88;
          }
        }
      }

      /* ── Section completion grid ──────────────────────────────────────── */
      .section-completion-grid {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .section-completion-item {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .section-completion-item__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-width: 200px;
      }

      .section-completion-item__label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      .section-completion-item__count {
        font-size: 0.78rem;
        color: var(--color-text-muted);
        font-family: 'Courier New', monospace;
      }

      .section-progress-bar {
        flex: 1;
        height: 8px;
        background: var(--color-divider);
        border-radius: 4px;
        overflow: hidden;
      }

      .section-progress-bar__fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.6s ease;

        &--gp {
          background: var(--color-primary);
        }
        &--ep {
          background: var(--color-success);
        }
        &--sf {
          background: var(--color-warning);
        }
      }

      .section-completion-item__pct {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--color-text-secondary);
        min-width: 36px;
        text-align: right;
      }

      /* ── Filter bar ──────────────────────────────────────────────────── */
      .udise-filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }

      .udise-search-wrap {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 200px;
        max-width: 360px;
      }

      .udise-search-icon {
        position: absolute;
        left: 10px;
        font-size: 16px;
        height: 16px;
        width: 16px;
        color: var(--color-text-muted);
        pointer-events: none;
      }

      .udise-search-input {
        width: 100%;
        padding: 9px 34px 9px 34px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-surface);
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s ease;
        box-sizing: border-box;
        &:focus {
          border-color: var(--color-primary);
        }
        &::placeholder {
          color: var(--color-text-muted);
        }
      }

      .udise-search-clear {
        position: absolute;
        right: 6px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        color: var(--color-text-muted);
        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
        }
        &:hover {
          color: var(--color-text-primary);
        }
      }

      .udise-filter-selects {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .udise-filter-select {
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-surface);
        color: var(--color-text-primary);
        font-size: 0.84rem;
        font-family: inherit;
        outline: none;
        cursor: pointer;
        transition: border-color 0.15s ease;
        &:focus {
          border-color: var(--color-primary);
        }
      }

      /* ── Year badge ──────────────────────────────────────────────────── */
      .udise-year-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        color: var(--color-text-muted);
        margin-bottom: 10px;
        mat-icon {
          font-size: 15px;
          height: 15px;
          width: 15px;
        }
        strong {
          color: var(--color-text-secondary);
        }
      }

      /* ── Section pills ───────────────────────────────────────────────── */
      .udise-section-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 700;
        background: color-mix(in srgb, var(--color-warning) 10%, transparent);
        color: color-mix(in srgb, var(--color-warning) 70%, #000);
        border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);

        &.complete {
          background: color-mix(in srgb, var(--color-success) 10%, transparent);
          color: color-mix(in srgb, var(--color-success) 70%, #000);
          border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
        }
      }

      /* ── Avatar variant for complete students ─────────────────────────── */
      .avatar-initials--complete {
        background: color-mix(in srgb, var(--color-success) 15%, transparent) !important;
        color: color-mix(in srgb, var(--color-success) 70%, #000) !important;
      }

      /* ── Edit button ─────────────────────────────────────────────────── */
      .udise-edit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
        padding: 0;
        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
        }
        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 6%, transparent);
        }
      }

      /* ── Empty state ─────────────────────────────────────────────────── */
      .udise-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 40px 20px;
        color: var(--color-text-muted);
        text-align: center;

        mat-icon {
          font-size: 40px;
          height: 40px;
          width: 40px;
          opacity: 0.4;
          color: var(--color-success);
        }
        h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }
        p {
          margin: 0;
          font-size: 0.84rem;
        }
      }
    `,
  ],
})
export class UdiseDashboard implements OnInit {
  loading = signal(true);
  report = signal<UDISECompletenessReport | null>(null);
  showExportDialog = signal(false);
  statusFilter = signal<'all' | 'complete' | 'partial' | 'not_started'>('all');
  searchQuery = '';

  selectedYearId: number | null = null;
  selectedClassSectionId: number | null = null;

  academicYears = signal<AcademicYear[]>([]);
  classSections = signal<ClassSection[]>([]);

  filteredStudents = computed(() => {
    const r = this.report();
    if (!r) return [];
    let students = r.students;

    // Status filter
    const sf = this.statusFilter();
    if (sf === 'complete') students = students.filter((s) => s.completeness.isComplete);
    if (sf === 'partial')
      students = students.filter((s) => !s.completeness.isComplete && s.completeness.score > 0);
    if (sf === 'not_started') students = students.filter((s) => s.completeness.score === 0);

    // Search
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      students = students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q) ||
          s.sectionName.toLowerCase().includes(q)
      );
    }

    return students;
  });

  constructor(
    private udiseService: StudentUdiseService,
    private academicsService: AcademicsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.academicsService.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years),
    });
    this.academicsService.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.selectedYearId) params.academicYearId = this.selectedYearId;
    if (this.selectedClassSectionId) params.classSectionId = this.selectedClassSectionId;

    this.udiseService.getCompleteness(params).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setStatusFilter(filter: 'all' | 'complete' | 'partial' | 'not_started'): void {
    this.statusFilter.set(filter);
  }

  onSearch(): void {
    // computed signal updates automatically
  }

  getPercent(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
