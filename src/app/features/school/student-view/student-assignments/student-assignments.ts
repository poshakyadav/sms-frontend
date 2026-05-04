// student-assignments/student-assignments.ts

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
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { Subject, takeUntil } from 'rxjs';
import { AssignmentsService, EnrichedAssignment, StudentOwnAssignmentFilters } from '../../../../core/services/assignments.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';


type FilterType = 'ALL' | 'CLASS_WORK' | 'HOME_WORK' | 'ASSIGNMENT';
type FilterStatus = 'ALL' | 'PENDING' | 'DONE';

interface AssignmentGroup {
  date: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  isOverdue: boolean;
  items: EnrichedAssignment[];
}

@Component({
  selector: 'app-student-assignments',
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
    MatChipsModule,
    MatBadgeModule,
  ],
  providers: [DatePipe],
  templateUrl: './student-assignments.html',
  styleUrl: './student-assignments.scss',
})
export class StudentAssignments implements OnInit, OnDestroy {
  private service = inject(AssignmentsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // ── State ──────────────────────────────────────────────────────────────────
  assignments = signal<EnrichedAssignment[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  submittingId = signal<number | null>(null);

  // ── Active filters ─────────────────────────────────────────────────────────
  activeType = signal<FilterType>('ALL');
  activeStatus = signal<FilterStatus>('ALL');

  filterForm = this.fb.group({
    dateFrom: [null as Date | null],
    dateTo: [null as Date | null],
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  stats = computed(() => {
    const all = this.assignments();
    const assignments = all.filter((a) => a.type === 'ASSIGNMENT');
    const pending = assignments.filter((a) => a.studentStatus === 'PENDING' || !a.studentStatus);
    const done = assignments.filter((a) => a.studentStatus === 'MARKED_AS_DONE');
    const overdue = pending.filter((a) => {
      const d = a.dueDate || a.targetDate;
      return d && new Date(d) < new Date();
    });
    return {
      total: all.length,
      assignments: assignments.length,
      pending: pending.length,
      done: done.length,
      overdue: overdue.length,
      homework: all.filter((a) => a.type === 'HOME_WORK').length,
      classwork: all.filter((a) => a.type === 'CLASS_WORK').length,
    };
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  filteredAssignments = computed(() => {
    let list = this.assignments();
    const type = this.activeType();
    const status = this.activeStatus();

    if (type !== 'ALL') list = list.filter((a) => a.type === type);
    if (status === 'PENDING')
      list = list.filter(
        (a) => a.type === 'ASSIGNMENT' && (a.studentStatus === 'PENDING' || !a.studentStatus)
      );
    if (status === 'DONE') list = list.filter((a) => a.studentStatus === 'MARKED_AS_DONE');

    return list;
  });

  // ── Grouped timeline ───────────────────────────────────────────────────────
  groupedAssignments = computed((): AssignmentGroup[] => {
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
        // Overdue first, then soonest
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  });

  ngOnInit(): void {
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
    this.loading.set(true);
    this.error.set(null);

    const fv = this.filterForm.value;
    const filters: StudentOwnAssignmentFilters = {};
    if (fv.dateFrom) filters.dateFrom = this.datePipe.transform(fv.dateFrom, 'yyyy-MM-dd')!;
    if (fv.dateTo) filters.dateTo = this.datePipe.transform(fv.dateTo, 'yyyy-MM-dd')!;

    this.service
      .getMyAssignments(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.assignments.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load assignments');
          this.loading.set(false);
        },
      });
  }

  markDone(assignment: EnrichedAssignment): void {
    if (this.submittingId() !== null) return;
    this.submittingId.set(assignment.id);

    this.service.markMyAssignmentDone(assignment.id).subscribe({
      next: () => {
        this.assignments.update((list) =>
          list.map((a) =>
            a.id === assignment.id ? { ...a, studentStatus: 'MARKED_AS_DONE' as const } : a
          )
        );
        this.toast.success('Assignment marked as done! 🎉');
        this.submittingId.set(null);
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? 'Could not mark as done');
        this.submittingId.set(null);
      },
    });
  }

  setTypeFilter(type: FilterType): void {
    this.activeType.set(type);
    if (type !== 'ASSIGNMENT' && this.activeStatus() !== 'ALL') {
      this.activeStatus.set('ALL');
    }
  }

  setStatusFilter(status: FilterStatus): void {
    this.activeStatus.set(status);
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

  getDisplayDate(a: EnrichedAssignment): string {
    return a.targetDate || a.dueDate || '';
  }

  trackById(_: number, a: EnrichedAssignment): number {
    return a.id;
  }

  trackByDate(_: number, g: AssignmentGroup): string {
    return g.date;
  }
}
