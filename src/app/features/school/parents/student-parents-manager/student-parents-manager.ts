// src/app/features/school/parents/student-parents-manager/student-parents-manager.ts

import {
  Component,
  inject,
  Input,
  OnInit,
  signal,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ParentService,
  ParentSearchResult,
  StudentParentLink,
} from '../../../../core/services/parent.service';
import { ToastService } from '../../../../core/services/toast.service';

const RELATIONSHIP_OPTIONS = [
  'Father',
  'Mother',
  'Guardian',
  'Grandfather',
  'Grandmother',
  'Uncle',
  'Aunt',
  'Elder Sibling',
  'Other',
];

@Component({
  selector: 'app-student-parents-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './student-parents-manager.html',
  styleUrl: './student-parents-manager.scss',
})
export class StudentParentsManager implements OnInit, OnChanges {
  @Input({ required: true }) studentId!: number;
  @Input() studentName = 'Student';

  private parentService = inject(ParentService);
  private toast = inject(ToastService);

  // ── State ──────────────────────────────────────────────────────────────────
  linkedParents = signal<StudentParentLink[]>([]);
  searchResults = signal<ParentSearchResult[]>([]);
  searchQuery = signal('');
  searching = signal(false);
  loadingParents = signal(false);

  // Assignment modal state
  showAssignModal = signal(false);
  selectedParent = signal<ParentSearchResult | null>(null);
  assignRelationship = signal('Father');
  assignIsPrimary = signal(false);
  assigning = signal(false);

  // Remove confirmation
  removingId = signal<number | null>(null);

  readonly relationshipOptions = RELATIONSHIP_OPTIONS;

  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.searchResults.set([]);
            this.searching.set(false);
            return of({ success: true, parents: [] as ParentSearchResult[] });
          }
          this.searching.set(true);
          return this.parentService.searchParents(q);
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (res) => {
          this.searchResults.set(res.parents ?? []);
          this.searching.set(false);
        },
        error: () => {
          this.searching.set(false);
        },
      });
  }

  ngOnInit(): void {
    this.loadLinkedParents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId'] && !changes['studentId'].firstChange) {
      this.loadLinkedParents();
    }
  }

  loadLinkedParents(): void {
    if (!this.studentId) return;
    this.loadingParents.set(true);
    this.parentService.getStudentParents(this.studentId).subscribe({
      next: (res) => {
        this.linkedParents.set(res.parents ?? []);
        this.loadingParents.set(false);
      },
      error: () => {
        this.toast.error('Failed to load parent links');
        this.loadingParents.set(false);
      },
    });
  }

  onSearchInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.searchQuery.set(q);
    this.searchSubject.next(q);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  // ── Called from template instead of arrow function ─────────────────────────
  onRelationshipChange(event: Event): void {
    this.assignRelationship.set((event.target as HTMLSelectElement).value);
  }

  // ── Replaces `assignIsPrimary.update(v => !v)` in template ────────────────
  toggleAssignIsPrimary(): void {
    this.assignIsPrimary.set(!this.assignIsPrimary());
  }

  openAssignModal(parent: ParentSearchResult): void {
    if (this.isAlreadyLinked(parent.userId)) {
      this.toast.error(`${parent.name} is already linked to ${this.studentName}`);
      return;
    }
    this.selectedParent.set(parent);
    this.assignRelationship.set('Father');
    const hasPrimary = this.linkedParents().some((l) => l.isPrimary);
    this.assignIsPrimary.set(!hasPrimary);
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.selectedParent.set(null);
  }

  confirmAssign(): void {
    const parent = this.selectedParent();
    if (!parent) return;

    this.assigning.set(true);
    this.parentService
      .assignParentToStudent(
        this.studentId,
        parent.userId,
        this.assignRelationship(),
        this.assignIsPrimary()
      )
      .subscribe({
        next: () => {
          this.toast.success(`${parent.name} assigned as ${this.assignRelationship()}`);
          this.assigning.set(false);
          this.closeAssignModal();
          this.clearSearch();
          this.loadLinkedParents();
        },
        error: (err) => {
          this.toast.error(err?.error?.error ?? 'Failed to assign parent');
          this.assigning.set(false);
        },
      });
  }

  togglePrimary(link: StudentParentLink): void {
    if (link.isPrimary) return;
    this.parentService
      .updateParentStudentLink(this.studentId, link.parentUserId, { isPrimary: true })
      .subscribe({
        next: () => {
          this.toast.success(`${link.parentName} set as primary contact`);
          this.loadLinkedParents();
        },
        error: () => this.toast.error('Failed to update'),
      });
  }

  removeParent(link: StudentParentLink): void {
    this.removingId.set(link.linkId);
    this.parentService.removeParentFromStudent(this.studentId, link.parentUserId).subscribe({
      next: () => {
        this.toast.success(`${link.parentName} removed`);
        this.removingId.set(null);
        this.loadLinkedParents();
      },
      error: () => {
        this.toast.error('Failed to remove parent');
        this.removingId.set(null);
      },
    });
  }

  isAlreadyLinked(parentUserId: number): boolean {
    return this.linkedParents().some((l) => l.parentUserId === parentUserId);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#3b82f6',
      '#ef4444',
      '#14b8a6',
    ];
    let hash = 0;
    for (const ch of name) hash += ch.charCodeAt(0);
    return colors[hash % colors.length];
  }
}
