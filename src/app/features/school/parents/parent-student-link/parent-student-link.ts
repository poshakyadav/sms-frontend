// src/app/features/school/parents/parent-student-link/parent-student-link.ts

import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '../../../../core/services/toast.service';
import {
  ParentService,
  ParentSearchResult,
  StudentSearchResult,
  StudentParentLink,
} from '../../../../core/services/parent.service';
import { StudentParentsManager } from '../student-parents-manager/student-parents-manager';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'by-student' | 'by-parent';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-parent-student-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    StudentParentsManager,
  ],
  templateUrl: './parent-student-link.html',
  styleUrl: './parent-student-link.scss',
})
export class ParentStudentLink implements OnInit {
  private toast = inject(ToastService);
  private parentService = inject(ParentService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // ── Page-level loading state (mirrors dashboard pattern) ──────────────────
  // Prevents full-page flash on repeated navigations.
  // Set to false only after the component has mounted in the browser.
  pageReady = signal(false);

  // ── Tab state ─────────────────────────────────────────────────────────────
  activeTab = signal<ActiveTab>('by-student');

  // ── Student search ────────────────────────────────────────────────────────
  studentQuery = signal('');
  studentResults = signal<StudentSearchResult[]>([]);
  searchingStudents = signal(false);
  selectedStudent = signal<StudentSearchResult | null>(null);

  // ── Parent search (by-parent tab) ─────────────────────────────────────────
  parentQuery = signal('');
  parentResults = signal<ParentSearchResult[]>([]);
  searchingParents = signal(false);
  selectedParent = signal<ParentSearchResult | null>(null);
  selectedParentLinks = signal<StudentParentLink[]>([]);
  loadingParentLinks = signal(false);

  private studentSearchSubject = new Subject<string>();
  private parentSearchSubject = new Subject<string>();

  constructor() {
    // ── Student search pipeline — uses the NEW dedicated parent module endpoint ─
    this.studentSearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.studentResults.set([]);
            this.searchingStudents.set(false);
            return of({ success: true, students: [] as StudentSearchResult[] });
          }
          this.searchingStudents.set(true);
          // ✅ Uses ParentService.searchStudents → GET /school/parent/search-students?q=...
          return this.parentService.searchStudents(q.trim());
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (res) => {
          this.studentResults.set(res.students ?? []);
          this.searchingStudents.set(false);
        },
        error: () => {
          this.searchingStudents.set(false);
          this.toast.error('Failed to search students. Please try again.');
        },
      });

    // ── Parent search pipeline — uses existing parent module endpoint ──────────
    this.parentSearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.parentResults.set([]);
            this.searchingParents.set(false);
            return of({ success: true, parents: [] as ParentSearchResult[] });
          }
          this.searchingParents.set(true);
          // ✅ Uses ParentService.searchParents → GET /school/parent/search?q=...
          return this.parentService.searchParents(q.trim());
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (res) => {
          this.parentResults.set(res.parents ?? []);
          this.searchingParents.set(false);
        },
        error: () => {
          this.searchingParents.set(false);
          this.toast.error('Failed to search parents. Please try again.');
        },
      });

    // ── Mark page as ready after first render (prevents flash on re-navigation) ─
    // Same pattern as the dashboard component uses afterNextRender.
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.pageReady.set(true);
      });
    }
  }

  ngOnInit(): void {
    // If not in browser (SSR), mark ready immediately so the template renders.
    if (!isPlatformBrowser(this.platformId)) {
      this.pageReady.set(true);
    }
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  setTab(tab: ActiveTab): void {
    if (this.activeTab() === tab) return; // no-op if already on this tab
    this.activeTab.set(tab);
    this.clearStudentSearch();
    this.clearParentSearch();
  }

  // ── Student search handlers ───────────────────────────────────────────────

  onStudentSearchInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.studentQuery.set(q);
    this.studentSearchSubject.next(q);
    if (!q) this.selectedStudent.set(null);
  }

  clearStudentSearch(): void {
    this.studentQuery.set('');
    this.studentResults.set([]);
    this.selectedStudent.set(null);
  }

  selectStudent(student: StudentSearchResult): void {
    this.selectedStudent.set(student);
    this.studentQuery.set(student.name);
    this.studentResults.set([]);
  }

  // ── Parent search handlers ────────────────────────────────────────────────

  onParentSearchInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.parentQuery.set(q);
    this.parentSearchSubject.next(q);
    if (!q) {
      this.selectedParent.set(null);
      this.selectedParentLinks.set([]);
    }
  }

  clearParentSearch(): void {
    this.parentQuery.set('');
    this.parentResults.set([]);
    this.selectedParent.set(null);
    this.selectedParentLinks.set([]);
  }

  selectParent(parent: ParentSearchResult): void {
    this.selectedParent.set(parent);
    this.parentQuery.set(parent.name);
    this.parentResults.set([]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  navigateToStudent(studentId: number): void {
    this.router.navigate(['/school/students', studentId]);
  }
}
