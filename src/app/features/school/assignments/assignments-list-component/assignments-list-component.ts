// assignments-list-component.ts

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import {
  AssignmentsService,
  EnrichedAssignment,
} from '../../../../core/services/assignments.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SubjectsService } from '../../../../core/services/subjects.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-assignments-list-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
  ],
  providers: [DatePipe],
  templateUrl: './assignments-list-component.html',
  styleUrl: './assignments-list-component.scss',
})
export class AssignmentsListComponent implements OnInit {
  private assignmentsService = inject(AssignmentsService);
  private subjects = inject(SubjectsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  // ── Permission flags ───────────────────────────────────────────────────────
  canCreate = computed(() => this.auth.hasPermission('assignments.create'));
  canEdit = computed(() => this.auth.hasPermission('assignments.edit'));
  canDelete = computed(() => this.auth.hasPermission('assignments.delete'));
  canGrade = computed(() => this.auth.hasPermission('assignments.grade'));
  isStudentView = computed(
    () =>
      !this.auth.hasAnyPermission(['assignments.create', 'assignments.edit', 'assignments.grade'])
  );

  // ── State ──────────────────────────────────────────────────────────────────
  assignmentsList = signal<EnrichedAssignment[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  teacherSubjects = signal<any[]>([]);

  // ── Filter form ────────────────────────────────────────────────────────────
  filterForm = this.fb.group({
    dateFrom: [null as Date | null],
    dateTo: [null as Date | null],
    classSubjectId: [null as number | null],
  });

  // ── Table columns for staff view ──────────────────────────────────────────
  displayedColumns = [
    'type',
    'title',
    'classSection',
    'subject',
    'teacher',
    'date',
    'maxMarks',
    'actions',
  ];

  // ── Grouped by date for student timeline ──────────────────────────────────
  groupedByDate = computed(() => {
    const tasks = this.assignmentsList();
    const map = new Map<string, EnrichedAssignment[]>();

    tasks.forEach((task) => {
      const dateKey = task.targetDate || task.dueDate || 'No Date';
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(task);
    });

    return Array.from(map.entries())
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => {
        if (a.date === 'No Date') return 1;
        if (b.date === 'No Date') return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  });

  ngOnInit(): void {
    this.loadSubjectsIfStaff();
    this.loadAssignments();
    this.filterForm.valueChanges.subscribe(() => this.loadAssignments());
  }

  private loadSubjectsIfStaff(): void {
    if (!this.isStudentView()) {
      const user = this.auth.schoolUser();
      if (!user) return;
      this.subjects.getTeacherAssignments(user.id).subscribe({
        next: (res) => this.teacherSubjects.set(res.assignments ?? []),
        error: () => {},
      });
    }
  }

  loadAssignments(): void {
    this.loading.set(true);
    this.error.set(null);

    const fv = this.filterForm.value;
    const filters: Record<string, any> = {};
    if (fv.dateFrom) filters['dateFrom'] = this.datePipe.transform(fv.dateFrom, 'yyyy-MM-dd')!;
    if (fv.dateTo) filters['dateTo'] = this.datePipe.transform(fv.dateTo, 'yyyy-MM-dd')!;
    if (fv.classSubjectId) filters['classSubjectId'] = fv.classSubjectId;

    const obs = {
      next: (list: EnrichedAssignment[]) => {
        this.assignmentsList.set(list);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.error.set(err?.message ?? 'Failed to load assignments');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    };

    if (this.isStudentView()) {
      const user = this.auth.schoolUser();
      if (user) filters['studentId'] = user.id;
      this.assignmentsService.getStudentAssignments(filters).subscribe(obs);
    } else {
      this.assignmentsService.getAssignments(filters).subscribe(obs);
    }
  }

  createNew(): void {
    this.router.navigate(['/school/assignments/new']);
  }

  edit(id: number): void {
    this.router.navigate(['/school/assignments/edit', id]);
  }

  delete(id: number): void {
    if (!confirm('Delete this assignment permanently? This cannot be undone.')) return;
    this.assignmentsService.deleteAssignment(id).subscribe({
      next: () => {
        this.assignmentsList.update((list) => list.filter((a) => a.id !== id));
        this.toast.success('Assignment deleted successfully');
      },
      error: (err) => this.toast.error(err?.message ?? 'Cannot delete – submissions may exist'),
    });
  }

  markDone(id: number): void {
    this.assignmentsService.studentSubmit(id).subscribe({
      next: () => {
        this.assignmentsList.update((list) =>
          list.map((a) => (a.id === id ? { ...a, studentStatus: 'MARKED_AS_DONE' as const } : a))
        );
        this.toast.success('Marked as done!');
      },
      error: (err) => this.toast.error(err?.message ?? 'Failed to mark as done'),
    });
  }

  viewSubmissions(id: number): void {
    this.router.navigate(['/school/assignments/submissions', id]);
  }

  clearFilters(): void {
    this.filterForm.reset();
  }

  getDisplayDate(a: EnrichedAssignment): string {
    return a.targetDate || a.dueDate || '—';
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'ASSIGNMENT':
        return 'assignment';
      case 'CLASS_WORK':
        return 'classwork';
      case 'HOME_WORK':
        return 'homework';
      default:
        return '';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'ASSIGNMENT':
        return 'Assignment';
      case 'CLASS_WORK':
        return 'Class Work';
      case 'HOME_WORK':
        return 'Homework';
      default:
        return type;
    }
  }

  getStudentStatusClass(status?: string): string {
    switch (status) {
      case 'MARKED_AS_DONE':
        return 'done';
      case 'PENDING':
        return 'pending';
      default:
        return 'pending';
    }
  }

  getStudentStatusLabel(status?: string): string {
    switch (status) {
      case 'MARKED_AS_DONE':
        return 'Done';
      case 'PENDING':
        return 'Pending';
      default:
        return 'Pending';
    }
  }
}
