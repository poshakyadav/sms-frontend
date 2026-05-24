// teacher-search-dropdown.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface TeacherOption {
  id: number;
  name: string;
  email?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-teacher-search-dropdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="tsd-wrap" [class.tsd-wrap--open]="isOpen()">
      <!-- ── Trigger ──────────────────────────────────────────────────────── -->
      <button
        type="button"
        class="tsd-trigger"
        [class.tsd-trigger--assigned]="!!selectedId()"
        (click)="toggleOpen()"
      >
        @if (selectedTeacher()) {
        <!-- ASSIGNED state -->
        <span class="tsd-trigger__assigned">
          <span class="tsd-avatar tsd-avatar--filled" aria-hidden="true">
            {{ initials(selectedTeacher()!.name) }}
          </span>
          <span class="tsd-trigger__info">
            <span class="tsd-trigger__name">{{ selectedTeacher()!.name }}</span>
            @if (selectedTeacher()!.email) {
            <span class="tsd-trigger__email">{{ selectedTeacher()!.email }}</span>
            }
          </span>
          <span class="tsd-assigned-pill" aria-hidden="true">Assigned</span>
        </span>
        } @else {
        <!-- UNASSIGNED state -->
        <span class="tsd-trigger__unassigned">
          <span class="tsd-avatar tsd-avatar--empty" aria-hidden="true">
            <mat-icon>person_add</mat-icon>
          </span>
          <span class="tsd-trigger__placeholder">Assign teacher</span>
        </span>
        }

        <mat-icon
          class="tsd-trigger__chevron"
          [class.tsd-trigger__chevron--open]="isOpen()"
          aria-hidden="true"
        >
          expand_more
        </mat-icon>
      </button>

      <!-- ── Dropdown panel ───────────────────────────────────────────────── -->
      @if (isOpen()) {
      <div class="tsd-dropdown" role="listbox" (click)="$event.stopPropagation()">
        <!-- Search -->
        <div class="tsd-search-row">
          <mat-icon class="tsd-search-icon" aria-hidden="true">search</mat-icon>
          <input
            class="tsd-search-input"
            type="text"
            placeholder="Search teachers..."
            [(ngModel)]="query"
            autocomplete="off"
            aria-label="Search teachers"
          />
          @if (query) {
          <button
            type="button"
            class="tsd-clear-btn"
            (click)="clearQuery()"
            aria-label="Clear search"
          >
            <mat-icon>close</mat-icon>
          </button>
          }
        </div>

        <!-- Current assignment banner: shown only when a teacher IS assigned -->
        @if (selectedTeacher()) {
        <div class="tsd-current-banner">
          <span class="tsd-current-banner__label">Currently assigned</span>
          <span class="tsd-current-banner__teacher">
            <span class="tsd-avatar tsd-avatar--filled tsd-avatar--sm" aria-hidden="true">
              {{ initials(selectedTeacher()!.name) }}
            </span>
            <span class="tsd-current-banner__name">{{ selectedTeacher()!.name }}</span>
          </span>
          <button
            type="button"
            class="tsd-current-banner__remove"
            (click)="select(null)"
            aria-label="Remove assigned teacher"
          >
            <mat-icon>close</mat-icon>
            Remove
          </button>
        </div>
        }

        <!-- Options list -->
        <div class="tsd-options">
          <!-- None option: only shown when nothing is assigned -->
          @if (!selectedId()) {
          <button
            type="button"
            class="tsd-option tsd-option--none tsd-option--active"
            role="option"
            aria-selected="true"
          >
            <span class="tsd-avatar tsd-avatar--none" aria-hidden="true">
              <mat-icon>person_off</mat-icon>
            </span>
            <span class="tsd-option__label">— Not assigned —</span>
            <mat-icon class="tsd-option__check" aria-hidden="true">check</mat-icon>
          </button>
          }

          <!-- No results message -->
          @if (filteredTeachers().length === 0 && query) {
          <div class="tsd-no-results" role="status">
            <mat-icon aria-hidden="true">search_off</mat-icon>
            No teachers match "{{ query }}"
          </div>
          }

          <!-- Teacher rows -->
          @for (t of filteredTeachers(); track t.id) {
          <button
            type="button"
            class="tsd-option"
            [class.tsd-option--active]="selectedId() === t.id"
            role="option"
            [attr.aria-selected]="selectedId() === t.id"
            (click)="select(t.id)"
          >
            <span
              class="tsd-avatar"
              [class.tsd-avatar--filled]="selectedId() === t.id"
              [class.tsd-avatar--idle]="selectedId() !== t.id"
              aria-hidden="true"
            >
              {{ initials(t.name) }}
            </span>
            <span class="tsd-option__info">
              <span class="tsd-option__name">{{ t.name }}</span>
              @if (t.email) {
              <span class="tsd-option__email">{{ t.email }}</span>
              }
            </span>
            @if (selectedId() === t.id) {
            <mat-icon class="tsd-option__check" aria-hidden="true">check_circle</mat-icon>
            }
          </button>
          }
        </div>

        <!-- Footer -->
        @if (teachers.length > 0) {
        <div class="tsd-footer" aria-live="polite">
          {{ filteredTeachers().length }} / {{ teachers.length }} teacher{{
            teachers.length !== 1 ? 's' : ''
          }}
        </div>
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
        width: 100%;
      }

      .tsd-wrap {
        position: relative;
        width: 100%;
      }

      /* ── Trigger ────────────────────────────────────────────────────────────── */
      .tsd-trigger {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 10px 0 12px;
        height: 56px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: transparent;
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: 0.875rem;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
        text-align: left;
        min-width: 0;

        &:hover {
          border-color: var(--color-text-secondary);
          background: color-mix(in srgb, var(--color-text-primary) 2%, transparent);
        }

        .tsd-wrap--open & {
          border-color: var(--color-primary);
          border-width: 2px;
          padding-left: 11px;
        }

        &--assigned {
          background: color-mix(in srgb, var(--color-primary) 4%, transparent);
          border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);

          &:hover {
            background: color-mix(in srgb, var(--color-primary) 7%, transparent);
            border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
          }
        }
      }

      .tsd-trigger__assigned {
        display: flex;
        align-items: center;
        gap: 9px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }

      .tsd-trigger__info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
      }

      .tsd-trigger__name {
        font-size: 0.84rem;
        font-weight: 600;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
      }

      .tsd-trigger__email {
        font-size: 0.7rem;
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }

      .tsd-assigned-pill {
        flex-shrink: 0;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 2px 7px;
        border-radius: 100px;
        background: color-mix(in srgb, var(--color-success) 12%, transparent);
        color: color-mix(in srgb, var(--color-success) 80%, #000);
        border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
      }

      .tsd-trigger__unassigned {
        display: flex;
        align-items: center;
        gap: 9px;
        flex: 1;
        min-width: 0;
      }

      .tsd-trigger__placeholder {
        font-size: 0.84rem;
        color: var(--color-text-muted);
        font-style: italic;
      }

      /* ── Chevron ────────────────────────────────────────────────────────────── */
      .tsd-trigger__chevron {
        font-size: 18px !important;
        height: 18px !important;
        width: 18px !important;
        color: var(--color-text-muted);
        transition: transform 0.2s ease, color 0.15s ease;
        flex-shrink: 0;

        &--open {
          transform: rotate(180deg);
          color: var(--color-primary);
        }
      }

      /* ── Avatars ────────────────────────────────────────────────────────────── */
      .tsd-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        line-height: 1;

        &--filled {
          background: var(--color-primary);
          color: #fff;
        }

        &--idle {
          background: color-mix(in srgb, var(--color-primary) 12%, transparent);
          color: var(--color-primary);
        }

        &--empty {
          background: var(--color-hover);
          border: 1.5px dashed var(--color-border);
          color: var(--color-text-muted);

          mat-icon {
            font-size: 15px !important;
            height: 15px !important;
            width: 15px !important;
          }
        }

        &--none {
          background: var(--color-hover);
          color: var(--color-text-muted);

          mat-icon {
            font-size: 15px !important;
            height: 15px !important;
            width: 15px !important;
          }
        }

        &--sm {
          width: 22px;
          height: 22px;
          font-size: 0.58rem;
        }
      }

      .tsd-trigger__assigned .tsd-avatar {
        width: 32px;
        height: 32px;
        font-size: 0.68rem;
      }

      /* ── Dropdown ────────────────────────────────────────────────────────────── */
      .tsd-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 900;
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        animation: tsd-in 0.12s ease;
      }

      @keyframes tsd-in {
        from {
          opacity: 0;
          transform: translateY(-6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ── Current assignment banner ───────────────────────────────────────────── */
      .tsd-current-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--color-primary) 5%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
        flex-wrap: wrap;

        &__label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }

        &__teacher {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        &__name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        &__remove {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 3px 9px 3px 6px;
          border-radius: 100px;
          border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
          background: color-mix(in srgb, var(--color-error) 6%, transparent);
          color: color-mix(in srgb, var(--color-error) 75%, #000);
          font-size: 0.72rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.12s ease, border-color 0.12s ease;

          mat-icon {
            font-size: 13px !important;
            height: 13px !important;
            width: 13px !important;
          }

          &:hover {
            background: color-mix(in srgb, var(--color-error) 12%, transparent);
            border-color: color-mix(in srgb, var(--color-error) 50%, transparent);
          }
        }
      }

      /* ── Search row ─────────────────────────────────────────────────────────── */
      .tsd-search-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-bottom: 1px solid var(--color-divider);
        background: var(--color-hover);
      }

      .tsd-search-icon {
        font-size: 15px !important;
        height: 15px !important;
        width: 15px !important;
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      .tsd-search-input {
        flex: 1;
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 0.84rem;
        font-family: inherit;
        outline: none;

        &::placeholder {
          color: var(--color-text-muted);
        }
      }

      .tsd-clear-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        color: var(--color-text-muted);
        border-radius: var(--radius-sm);
        transition: all 0.12s ease;

        mat-icon {
          font-size: 14px !important;
          height: 14px !important;
          width: 14px !important;
        }

        &:hover {
          background: var(--color-border);
          color: var(--color-text-primary);
        }
      }

      /* ── Options list ────────────────────────────────────────────────────────── */
      .tsd-options {
        max-height: 220px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;

        &::-webkit-scrollbar {
          width: 4px;
        }
        &::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 2px;
        }
      }

      .tsd-option {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: 0.84rem;
        cursor: pointer;
        text-align: left;
        transition: background 0.12s ease;
        border-bottom: 1px solid var(--color-divider);

        &:last-child {
          border-bottom: none;
        }
        &:hover:not(.tsd-option--active) {
          background: var(--color-hover);
        }

        &--active {
          background: color-mix(in srgb, var(--color-primary) 7%, transparent);
          box-shadow: inset 3px 0 0 var(--color-primary);
        }

        &--none .tsd-option__label {
          font-style: italic;
          font-weight: 400;
          color: var(--color-text-muted);
        }
      }

      .tsd-option__info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .tsd-option__name {
        font-size: 0.84rem;
        font-weight: 500;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        .tsd-option--active & {
          font-weight: 600;
          color: var(--color-primary);
        }
      }

      .tsd-option__label {
        font-size: 0.84rem;
        color: var(--color-text-muted);
      }

      .tsd-option__email {
        font-size: 0.7rem;
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tsd-option__check {
        font-size: 17px !important;
        height: 17px !important;
        width: 17px !important;
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .tsd-no-results {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 14px 12px;
        font-size: 0.82rem;
        color: var(--color-text-muted);
        font-style: italic;

        mat-icon {
          font-size: 16px !important;
          height: 16px !important;
          width: 16px !important;
          opacity: 0.6;
        }
      }

      .tsd-footer {
        padding: 6px 12px;
        font-size: 0.68rem;
        color: var(--color-text-muted);
        background: var(--color-hover);
        border-top: 1px solid var(--color-divider);
        text-align: right;
      }
    `,
  ],
})
export class TeacherSearchDropdownComponent implements OnChanges {
  @Input() teachers: TeacherOption[] = [];
  @Input() selectedTeacherId: number | null = null;
  @Output() teacherSelected = new EventEmitter<number | null>();

  private elRef = inject(ElementRef);

  isOpen = signal(false);
  query = '';

  // ── Internal signal mirroring the @Input ──────────────────────────────────
  // WHY: selectedTeacherId is a plain @Input, not a signal. Angular updates it
  // via property assignment during change detection, but computed() can only
  // track signal reads. If selectedTeacher computed read this.selectedTeacherId
  // directly it would only evaluate once (at creation) and never re-run.
  //
  // Solution: ngOnChanges syncs the @Input into selectedId (a real signal)
  // whenever Angular pushes a new value. computed() reads selectedId() so it
  // re-runs on every change — including when the parent FormControl calls
  // setValue() from bulkPromoteStudents or _refillRows in OnPush components.
  readonly selectedId = signal<number | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if ('selectedTeacherId' in changes) {
      this.selectedId.set(this.selectedTeacherId ?? null);
    }
  }

  // ── Resolved teacher object ────────────────────────────────────────────────
  selectedTeacher = computed<TeacherOption | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.teachers.find((t) => t.id === id) ?? null;
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  filteredTeachers = computed(() => {
    const q = this.query.toLowerCase().trim();
    if (!q) return this.teachers;
    return this.teachers.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q)
    );
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  toggleOpen(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) this.query = '';
  }

  select(id: number | null): void {
    // Update the internal signal immediately so the trigger re-renders in the
    // same tick — staff see the change before the dropdown closes.
    this.selectedId.set(id);
    this.teacherSelected.emit(id);
    this.isOpen.set(false);
    this.query = '';
  }

  clearQuery(): void {
    this.query = '';
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
