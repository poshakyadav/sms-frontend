// features/school/students/history/student-history-search-autocomplete/student-history-search-autocomplete.ts
import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  StudentHistoryService,
  StudentSearchResult,
} from '../../../../../core/services/student-history.service';

@Component({
  selector: 'app-student-history-search-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-autocomplete" [class.search-autocomplete--open]="isOpen()">
      <!-- Input -->
      <div class="search-autocomplete__input-wrap">
        <div class="search-autocomplete__icon">
          <svg
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
        </div>
        <input
          class="search-autocomplete__input"
          type="text"
          [placeholder]="placeholder"
          [(ngModel)]="query"
          (ngModelChange)="onQueryChange($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          autocomplete="off"
        />
        @if (loading()) {
        <div class="search-autocomplete__spinner">
          <div class="spinner-ring"></div>
        </div>
        } @else if (query.length > 0) {
        <button class="search-autocomplete__clear" (mousedown)="clearQuery()">
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

      <!-- Dropdown -->
      @if (isOpen() && (results().length > 0 || (query.length >= 2 && !loading()))) {
      <div class="search-autocomplete__dropdown">
        @if (results().length === 0 && !loading()) {
        <div class="search-autocomplete__empty">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>No students found for "{{ query }}"</span>
        </div>
        } @for (student of results(); track student.id) {
        <button class="search-autocomplete__result" (mousedown)="selectStudent(student)">
          <div class="result-avatar">
            @if (student.avatarUrl) {
            <img [src]="student.avatarUrl" [alt]="student.name" />
            } @else {
            <span>{{ getInitials(student.name) }}</span>
            }
          </div>
          <div class="result-info">
            <div class="result-name">
              {{ student.name }}
              @if (student.isDeparted) {
              <span class="result-alumni-badge">Alumni</span>
              }
            </div>
            <div class="result-sub">
              @if (student.currentEnrollment) {
              <span
                >{{ student.currentEnrollment.className }}
                {{ student.currentEnrollment.sectionName }}</span
              >
              <span class="result-dot">·</span>
              } @if (student.admissionNumber) {
              <span>Adm: {{ student.admissionNumber }}</span>
              <span class="result-dot">·</span>
              }
              <span>{{ student.email }}</span>
            </div>
          </div>
        </button>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .search-autocomplete {
        position: relative;
      }

      .search-autocomplete__input-wrap {
        display: flex;
        align-items: center;
        gap: 0;
        background: var(--color-bg-card);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-md);
        transition: border-color 0.15s, box-shadow 0.15s;
        overflow: hidden;
      }

      .search-autocomplete--open .search-autocomplete__input-wrap,
      .search-autocomplete__input-wrap:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
      }

      .search-autocomplete__icon {
        padding: 0 12px;
        color: var(--color-text-muted);
        flex-shrink: 0;
        display: flex;
        align-items: center;
      }

      .search-autocomplete__input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        padding: 11px 0;
        font-size: 0.9rem;
        color: var(--color-text-primary);
        font-family: inherit;
        min-width: 0;

        &::placeholder {
          color: var(--color-text-muted);
        }
      }

      .search-autocomplete__spinner,
      .search-autocomplete__clear {
        flex-shrink: 0;
        padding: 0 12px;
        display: flex;
        align-items: center;
      }

      .search-autocomplete__clear {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
        padding: 0 10px;
        height: 100%;
        &:hover {
          color: var(--color-text-primary);
        }
      }

      .spinner-ring {
        width: 16px;
        height: 16px;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .search-autocomplete__dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 200;
        overflow: hidden;
        max-height: 340px;
        overflow-y: auto;
        scrollbar-width: thin;
      }

      .search-autocomplete__empty {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 18px 16px;
        color: var(--color-text-muted);
        font-size: 0.875rem;
      }

      .search-autocomplete__result {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 11px 14px;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        border-bottom: 1px solid var(--color-divider);
        transition: background 0.12s;

        &:last-child {
          border-bottom: none;
        }
        &:hover {
          background: var(--color-hover);
        }
      }

      .result-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
        color: var(--color-primary);
        font-size: 0.72rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .result-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .result-name {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-primary);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .result-alumni-badge {
        font-size: 0.62rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 1px 6px;
        border-radius: 100px;
        background: color-mix(in srgb, var(--color-warning) 14%, transparent);
        color: color-mix(in srgb, var(--color-warning) 70%, #000);
        border: 1px solid color-mix(in srgb, var(--color-warning) 25%, transparent);
      }

      .result-sub {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .result-dot {
        color: var(--color-border);
      }
    `,
  ],
})
export class StudentHistorySearchAutocomplete implements OnInit, OnDestroy {

  private historyService = inject(StudentHistoryService);

  @Input() placeholder = 'Search students by name, email, admission no…';
  @Input() status: 'active' | 'departed' | 'all' = 'all';
  @Output() studentSelected = new EventEmitter<StudentSearchResult>();

  query = '';
  results = signal<StudentSearchResult[]>([]);
  loading = signal(false);
  isOpen = signal(false);

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {}

  ngOnInit() {
    this.search$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.length < 2) {
            this.results.set([]);
            this.loading.set(false);
            return of(null);
          }
          this.loading.set(true);
          return this.historyService.searchStudents({ q, status: this.status, limit: 12 });
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res) this.results.set(res.results ?? []);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryChange(val: string) {
    this.query = val;
    this.search$.next(val);
    if (val.length >= 2) this.isOpen.set(true);
    else {
      this.isOpen.set(false);
      this.results.set([]);
    }
  }

  onFocus() {
    if (this.query.length >= 2 && this.results().length > 0) this.isOpen.set(true);
  }
  onBlur() {
    setTimeout(() => this.isOpen.set(false), 150);
  }

  clearQuery() {
    this.query = '';
    this.results.set([]);
    this.isOpen.set(false);
    this.loading.set(false);
  }

  selectStudent(student: StudentSearchResult) {
    this.query = student.name;
    this.isOpen.set(false);
    this.studentSelected.emit(student);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
}
