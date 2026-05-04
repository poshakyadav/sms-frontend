// parent-assignments/parent-assignments.ts

import { Component, computed, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { AssignmentsService, EnrichedAssignment, StudentOwnAssignmentFilters } from '../../../../core/services/assignments.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ParentService } from '../../../../core/services/parent.service';
import { ToastService } from '../../../../core/services/toast.service';


type FilterType = 'ALL' | 'CLASS_WORK' | 'HOME_WORK' | 'ASSIGNMENT';
type FilterStatus = 'ALL' | 'PENDING' | 'DONE' | 'GRADED';

interface SubjectGroup {
  subject: string;
  items: EnrichedAssignment[];
  pending: number;
  done: number;
}

interface AssignmentGroup {
  date: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  isOverdue: boolean;
  items: EnrichedAssignment[];
}

@Component({
  selector: 'app-parent-assignments',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
  ],
  providers: [DatePipe],
  templateUrl: './parent-assignments.html',
  styleUrl: './parent-assignments.scss',
})
export class ParentAssignments implements OnInit, OnDestroy {
  private service = inject(AssignmentsService);
  private auth = inject(AuthService);
  private parentService = inject(ParentService);
  private toast = inject(ToastService);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // ── State ──────────────────────────────────────────────────────────────────
  assignments = signal<EnrichedAssignment[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  noChildSelected = signal(false);

  // ── View mode ──────────────────────────────────────────────────────────────
  viewMode = signal<'timeline' | 'subject'>('timeline');

  // ── Filters ────────────────────────────────────────────────────────────────
  activeType = signal<FilterType>('ALL');
  activeStatus = signal<FilterStatus>('ALL');

  filterForm = this.fb.group({
    dateFrom: [null as Date | null],
    dateTo: [null as Date | null],
  });

  // ── Child info from ParentService ──────────────────────────────────────────
  activeChild = computed(() => {
    const children = this.parentService.children();
    const activeId = this.parentService.activeChildId();
    return children?.find((c) => c.studentId === activeId) ?? null;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  stats = computed(() => {
    const all = this.assignments();
    const assignmentsOnly = all.filter((a) => a.type === 'ASSIGNMENT');
    const pending = assignmentsOnly.filter(
      (a) => a.studentStatus === 'PENDING' || !a.studentStatus
    );
    const done = assignmentsOnly.filter((a) => a.studentStatus === 'MARKED_AS_DONE');
    const graded = assignmentsOnly.filter((a) => a.teacherStatus === 'GRADED');
    const overdue = pending.filter((a) => {
      const d = a.dueDate || a.targetDate;
      return d && new Date(d) < new Date();
    });
    const avgScore =
      graded.length > 0
        ? graded
            .filter((a) => a.marksObtained != null && a.maxMarks)
            .reduce((sum, a) => sum + ((a.marksObtained ?? 0) / (a.maxMarks ?? 1)) * 100, 0) /
          Math.max(graded.filter((a) => a.maxMarks).length, 1)
        : null;

    return {
      total: all.length,
      assignments: assignmentsOnly.length,
      pending: pending.length,
      done: done.length,
      graded: graded.length,
      overdue: overdue.length,
      homework: all.filter((a) => a.type === 'HOME_WORK').length,
      classwork: all.filter((a) => a.type === 'CLASS_WORK').length,
      completionRate:
        assignmentsOnly.length > 0 ? Math.round((done.length / assignmentsOnly.length) * 100) : 0,
      avgScore: avgScore !== null ? Math.round(avgScore) : null,
    };
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  filteredAssignments = computed(() => {
    let list = this.assignments();
    const type = this.activeType();
    const status = this.activeStatus();

    if (type !== 'ALL') list = list.filter((a) => a.type === type);
    if (status === 'PENDING')
      list = list.filter((a) => a.studentStatus === 'PENDING' || !a.studentStatus);
    if (status === 'DONE') list = list.filter((a) => a.studentStatus === 'MARKED_AS_DONE');
    if (status === 'GRADED') list = list.filter((a) => a.teacherStatus === 'GRADED');

    return list;
  });

  // ── Timeline grouped ───────────────────────────────────────────────────────
  groupedByDate = computed((): AssignmentGroup[] => {
    const list = this.filteredAssignments();
    const map = new Map<string, EnrichedAssignment[]>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    list.forEach((a) => {
      const key = a.targetDate || a.dueDate || 'no-date';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });

    return Array.from(map.entries())
      .map(([date, items]) => {
        const d = date === 'no-date' ? null : new Date(date);
        d?.setHours(0, 0, 0, 0);
        return {
          date,
          label:
            date === 'no-date'
              ? 'No Due Date'
              : d?.getTime() === today.getTime()
              ? 'Today'
              : d?.getTime() === tomorrow.getTime()
              ? 'Tomorrow'
              : this.datePipe.transform(date, 'EEE, MMM d, yyyy') ?? date,
          isToday: d?.getTime() === today.getTime(),
          isTomorrow: d?.getTime() === tomorrow.getTime(),
          isOverdue: !!d && d < today,
          items,
        };
      })
      .sort((a, b) => {
        if (a.date === 'no-date') return 1;
        if (b.date === 'no-date') return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  });

  // ── Subject grouped ────────────────────────────────────────────────────────
  groupedBySubject = computed((): SubjectGroup[] => {
    const list = this.filteredAssignments();
    const map = new Map<string, EnrichedAssignment[]>();

    list.forEach((a) => {
      if (!map.has(a.subjectName)) map.set(a.subjectName, []);
      map.get(a.subjectName)!.push(a);
    });

    return Array.from(map.entries())
      .map(([subject, items]) => ({
        subject,
        items,
        pending: items.filter((a) => a.studentStatus === 'PENDING' || !a.studentStatus).length,
        done: items.filter((a) => a.studentStatus === 'MARKED_AS_DONE').length,
      }))
      .sort((a, b) => b.pending - a.pending);
  });

  ngOnInit(): void {
    const childId = this.parentService.activeChildId();
    if (!childId) {
      this.noChildSelected.set(true);
      this.loading.set(false);
      return;
    }
    this.loadAssignments();
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadAssignments());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAssignments(): void {
    const childId = this.parentService.activeChildId();
    if (!childId) {
      this.noChildSelected.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.noChildSelected.set(false);

    const fv = this.filterForm.value;
    const filters: StudentOwnAssignmentFilters = {};
    if (fv.dateFrom) filters.dateFrom = this.datePipe.transform(fv.dateFrom, 'yyyy-MM-dd')!;
    if (fv.dateTo) filters.dateTo = this.datePipe.transform(fv.dateTo, 'yyyy-MM-dd')!;

    this.service
      .getChildAssignments(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.assignments.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          if (err?.error?.requiresChildSelection) {
            this.noChildSelected.set(true);
          } else {
            this.error.set(err?.error?.error ?? 'Failed to load assignments');
          }
          this.loading.set(false);
        },
      });
  }

  setTypeFilter(type: FilterType): void {
    this.activeType.set(type);
  }

  setStatusFilter(status: FilterStatus): void {
    this.activeStatus.set(status);
  }

  setViewMode(mode: 'timeline' | 'subject'): void {
    this.viewMode.set(mode);
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.activeType.set('ALL');
    this.activeStatus.set('ALL');
  }

  isOverdue(a: EnrichedAssignment): boolean {
    const d = a.dueDate || a.targetDate;
    if (!d) return false;
    const due = new Date(d);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today && a.studentStatus !== 'MARKED_AS_DONE';
  }

  getScorePercent(a: EnrichedAssignment): number {
    if (!a.maxMarks || a.marksObtained == null) return 0;
    return Math.round((a.marksObtained / a.maxMarks) * 100);
  }

  getScoreColor(pct: number): string {
    if (pct >= 80) return 'score--high';
    if (pct >= 55) return 'score--mid';
    return 'score--low';
  }

  getTypeConfig(type: string): { label: string; icon: string; cssClass: string } {
    switch (type) {
      case 'ASSIGNMENT':
        return { label: 'Assignment', icon: 'assignment', cssClass: 'type-assignment' };
      case 'CLASS_WORK':
        return { label: 'Class Work', icon: 'class', cssClass: 'type-classwork' };
      case 'HOME_WORK':
        return { label: 'Homework', icon: 'home', cssClass: 'type-homework' };
      default:
        return { label: type, icon: 'task', cssClass: '' };
    }
  }

  trackById(_: number, a: EnrichedAssignment): number {
    return a.id;
  }
  trackByDate(_: number, g: AssignmentGroup): string {
    return g.date;
  }
  trackBySubject(_: number, g: SubjectGroup): string {
    return g.subject;
  }
}
