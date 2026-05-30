// features/school/students/history/students-history-list/students-history-list.ts
import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  AllStudentRow,
  AllStudentsHistoryParams,
  StudentHistoryService,
} from '../../../../../core/services/student-history.service';
import { StudentHistoryStatsCard } from '../student-history-stats-card/student-history-stats-card';

type StatusFilter = 'all' | 'active' | 'departed';
type SortBy = 'name' | 'admissionDate' | 'createdAt';

@Component({
  selector: 'app-students-history-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  template: `
    <div class="page-wrapper">
      <!-- ── Page Header ───────────────────────────────────────── -->
      <div class="page-header">
        <div class="page-header__info">
          <h1>
            <span class="header-icon">📚</span>
            Student History
          </h1>
          <p>Complete academic records for all students — active and alumni</p>
        </div>
      </div>

      <!-- ── Summary Stats ─────────────────────────────────────── -->
      <div class="summary-strip">
        <button
          class="summary-chip"
          [class.active]="statusFilter() === 'all'"
          (click)="setStatus('all')"
        >
          <span class="chip-count">{{ pagination().total }}</span>
          <span class="chip-label">All Students</span>
        </button>
        <button
          class="summary-chip"
          [class.active]="statusFilter() === 'active'"
          (click)="setStatus('active')"
        >
          <span class="chip-dot chip-dot--green"></span>
          <span class="chip-label">Active</span>
        </button>
        <button
          class="summary-chip"
          [class.active]="statusFilter() === 'departed'"
          (click)="setStatus('departed')"
        >
          <span class="chip-dot chip-dot--amber"></span>
          <span class="chip-label">Alumni / Departed</span>
        </button>
      </div>

      <!-- ── Search + Filters ──────────────────────────────────── -->
      <div class="section-card">
        <div class="toolbar">
          <div class="toolbar__search">
            <div class="search-input-wrap">
              <svg
                class="search-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                class="search-input"
                type="text"
                placeholder="Search by name, email, admission no., father's name…"
                [(ngModel)]="searchQuery"
                (ngModelChange)="onSearchChange($event)"
              />
              @if (searchQuery) {
              <button class="search-clear" (click)="clearSearch()">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              }
            </div>
          </div>

          <div class="toolbar__controls">
            <div class="sort-group">
              <label class="sort-label">Sort</label>
              <select class="sort-select" [(ngModel)]="sortBy" (ngModelChange)="onSortChange()">
                <option value="name">Name</option>
                <option value="admissionDate">Admission Date</option>
                <option value="createdAt">Date Created</option>
              </select>
              <button
                class="sort-order-btn"
                (click)="toggleSortOrder()"
                [title]="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
              >
                @if (sortOrder === 'asc') {
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                } @else {
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
                }
              </button>
            </div>
          </div>
        </div>

        <!-- ── Table ───────────────────────────────────────────── -->
        @if (loading()) {
        <div class="loading-overlay">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading student history…</p>
        </div>
        } @else if (students().length === 0) {
        <div class="empty-state">
          <div class="empty-state__icon">📋</div>
          <h3>No students found</h3>
          <p>
            {{
              searchQuery ? 'Try a different search term.' : 'No students match the current filter.'
            }}
          </p>
        </div>
        } @else {
        <div class="overflow-x">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class / Status</th>
                <th class="th-align-center">Years</th>
                <th class="th-align-center">Attendance</th>
                <th class="th-align-right">Fee Paid</th>
                <th class="th-align-center">Exams</th>
                <th class="th-align-right"></th>
              </tr>
            </thead>
            <tbody>
              @for (student of students(); track student.id) {
              <tr class="table-row clickable-row" (click)="openDetail(student.id)">
                <!-- Student cell -->
                <td>
                  <div class="student-cell">
                    <div class="avatar-initials" [class.avatar-inactive]="student.isDeparted">
                      {{ getInitials(student.name) }}
                    </div>
                    <div class="student-cell-info">
                      <span class="cell-name">{{ student.name }}</span>
                      <span class="cell-sub">
                        {{ student.email }}
                        @if (student.admissionNumber) { ·
                        <span class="roll-chip">{{ student.admissionNumber }}</span>
                        }
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Class / Status -->
                <td>
                  @if (student.isDeparted) {
                  <div class="departed-info">
                    <span class="status-chip status-chip--warning">Alumni</span>
                    @if (student.lastEnrollment) {
                    <span class="cell-sub" style="margin-top:3px">
                      Last: {{ student.lastEnrollment.className }}
                      {{ student.lastEnrollment.sectionName }}
                    </span>
                    }
                  </div>
                  } @else if (student.currentEnrollment) {
                  <div class="class-info-cell">
                    <span class="class-pill"
                      >{{ student.currentEnrollment.className }}
                      {{ student.currentEnrollment.sectionName }}</span
                    >
                    <span class="cell-sub" style="margin-top:3px">{{
                      student.currentEnrollment.academicYearName
                    }}</span>
                  </div>
                  } @else {
                  <span class="status-chip status-chip--muted">Not enrolled</span>
                  }
                </td>

                <!-- Years -->
                <td class="td-align-center">
                  <span class="years-badge">{{ student.totalYearsEnrolled }}</span>
                </td>

                <!-- Attendance -->
                <td class="td-align-center">
                  @if (student.stats.attendancePercentage != null) {
                  <div class="att-cell">
                    <span class="att-pct" [class]="getAttClass(student.stats.attendancePercentage)">
                      {{ student.stats.attendancePercentage | number : '1.0-1' }}%
                    </span>
                    <div class="att-bar-track">
                      <div
                        class="att-bar-fill"
                        [class]="getAttClass(student.stats.attendancePercentage)"
                        [style.width.%]="student.stats.attendancePercentage"
                      ></div>
                    </div>
                  </div>
                  } @else {
                  <span class="cell-muted">—</span>
                  }
                </td>

                <!-- Fee Paid -->
                <td class="td-align-right">
                  <span class="fee-amount"
                    >₹{{ student.stats.totalFeePaidRupees | number : '1.0-0' }}</span
                  >
                </td>

                <!-- Exams -->
                <td class="td-align-center">
                  <span class="exam-count">{{ student.stats.totalExamMarksEntered }}</span>
                </td>

                <!-- Action -->
                <td class="col-action">
                  <button
                    class="view-btn"
                    (click)="openDetail(student.id); $event.stopPropagation()"
                  >
                    View
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar">
          <span class="pagination-info">
            Showing {{ offset() + 1 }}–{{
              Math.min(offset() + pagination().limit, pagination().total)
            }}
            of {{ pagination().total }} students
          </span>
          <div class="pagination-controls">
            <button
              class="pag-btn"
              [disabled]="currentPage() === 1"
              (click)="goToPage(currentPage() - 1)"
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
            <span class="pag-pages">{{ currentPage() }} / {{ pagination().totalPages }}</span>
            <button
              class="pag-btn"
              [disabled]="currentPage() >= pagination().totalPages"
              (click)="goToPage(currentPage() + 1)"
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

      .header-icon {
        margin-right: 6px;
      }

      .summary-strip {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }

      .summary-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 16px;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--color-border);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
        box-shadow: var(--shadow-sm);

        &.active {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-card));
        }
        &:hover:not(.active) {
          background: var(--color-hover);
        }
      }

      .chip-count {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .chip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .chip-dot--green {
        background: var(--color-success);
      }
      .chip-dot--amber {
        background: var(--color-warning);
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--color-divider);
        flex-wrap: wrap;
      }

      .toolbar__search {
        flex: 1;
        min-width: 220px;
      }

      .search-input-wrap {
        display: flex;
        align-items: center;
        gap: 0;
        background: var(--color-bg-main);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm);
        transition: border-color 0.15s;
        &:focus-within {
          border-color: var(--color-primary);
        }
      }

      .search-icon {
        padding: 0 10px;
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      .search-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        padding: 9px 0;
        font-size: 0.875rem;
        color: var(--color-text-primary);
        font-family: inherit;
        &::placeholder {
          color: var(--color-text-muted);
        }
      }

      .search-clear {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0 10px;
        color: var(--color-text-muted);
        &:hover {
          color: var(--color-text-primary);
        }
      }

      .toolbar__controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sort-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .sort-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--color-text-muted);
      }

      .sort-select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-card);
        color: var(--color-text-primary);
        font-size: 0.84rem;
        font-family: inherit;
        padding: 6px 10px;
        cursor: pointer;
        outline: none;
        &:focus {
          border-color: var(--color-primary);
        }
      }

      .sort-order-btn {
        width: 32px;
        height: 32px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
      }

      /* Table enhancements */
      .clickable-row {
        cursor: pointer;
      }

      .departed-info,
      .class-info-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .class-pill {
        display: inline-block;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        color: var(--color-primary);
        width: fit-content;
      }

      .years-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
        color: var(--color-secondary);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .att-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
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

      .att-bar-track {
        width: 60px;
        height: 4px;
        background: var(--color-divider);
        border-radius: 2px;
        overflow: hidden;
      }

      .att-bar-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.4s;
      }
      .att-bar-fill.good {
        background: var(--color-success);
      }
      .att-bar-fill.warn {
        background: var(--color-warning);
      }
      .att-bar-fill.poor {
        background: var(--color-error);
      }

      .fee-amount {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
      }

      .exam-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 22px;
        border-radius: 100px;
        background: color-mix(in srgb, var(--color-info) 12%, transparent);
        color: var(--color-info);
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0 8px;
      }

      .view-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 12px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
        white-space: nowrap;
        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 5%, transparent);
        }
      }

      .pagination-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-top: 1px solid var(--color-divider);
        background: var(--color-hover);
        flex-wrap: wrap;
        gap: 10px;
      }

      .pagination-info {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 8px;
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

      .pag-pages {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        min-width: 60px;
        text-align: center;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        gap: 10px;

        &__icon {
          font-size: 2.5rem;
        }
        h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }
      }
    `,
  ],
})
export class StudentsHistoryList implements OnInit, OnDestroy {

  private historyService = inject(StudentHistoryService);
  private router = inject(Router);


  students = signal<AllStudentRow[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  pagination = signal({ total: 0, limit: 30, totalPages: 1 });

  statusFilter = signal<StatusFilter>('all');
  sortBy: SortBy = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  searchQuery = '';

  offset = computed(() => (this.currentPage() - 1) * this.pagination().limit);
  Math = Math;

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {}

  ngOnInit() {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage.set(1);
        this.load();
      });

    this.load();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load() {
    this.loading.set(true);
    const params: AllStudentsHistoryParams = {
      q: this.searchQuery || undefined,
      status: this.statusFilter(),
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      page: this.currentPage(),
      limit: 30,
    };
    this.historyService.getAllStudentsHistory(params).subscribe({
      next: (res) => {
        this.students.set(res.students ?? []);
        this.pagination.set(res.pagination);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.search$.next(val);
  }
  clearSearch() {
    this.searchQuery = '';
    this.currentPage.set(1);
    this.load();
  }

  setStatus(s: StatusFilter) {
    this.statusFilter.set(s);
    this.currentPage.set(1);
    this.load();
  }

  onSortChange() {
    this.currentPage.set(1);
    this.load();
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.currentPage.set(1);
    this.load();
  }

  goToPage(p: number) {
    this.currentPage.set(p);
    this.load();
  }

  openDetail(id: number) {
    this.router.navigate(['/school/students/history', id]);
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
