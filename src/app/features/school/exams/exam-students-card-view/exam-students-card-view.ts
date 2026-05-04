// src/app/features/school/exams/exam-students-card-view/exam-students-card-view.ts

import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AcademicsService } from '../../../../core/services/academics.service';
import { ExamsService } from '../../../../core/services/exams.service';
import { ToastService } from '../../../../core/services/toast.service';

export interface EnrolledStudentRow {
  userId: number;
  name: string;
  email: string;
  rollNumber: string | null;
  enrollmentId: number;
}

@Component({
  selector: 'app-exam-students-card-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './exam-students-card-view.html',
  styleUrl: './exam-students-card-view.scss',
})
export class ExamStudentsCardView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private examsService = inject(ExamsService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);

  examId = signal<number | null>(null);
  exam = signal<any | null>(null);
  students = signal<EnrolledStudentRow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  searchQuery = signal('');

  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.students();
    return this.students().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.rollNumber ?? '').toLowerCase().includes(q)
    );
  });

  displayedColumns = ['index', 'name', 'email', 'rollNumber', 'admitCard', 'reportCard'];

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('examId'));
    if (!id || isNaN(id)) {
      this.error.set('Invalid exam ID');
      this.loading.set(false);
      return;
    }
    this.examId.set(id);
    this.loadData(id);
  }

  private loadData(examId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.examsService.getById(examId).subscribe({
      next: (exam) => {
        this.exam.set(exam);
        this.loadEnrollments(exam.classSectionId);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load exam details');
        this.loading.set(false);
      },
    });
  }

  private loadEnrollments(classSectionId: number): void {
    this.academicsService.getEnrollments().subscribe({
      next: (res) => {
        const active = res.enrollments.filter(
          (e) => e.classSectionId === classSectionId && e.isActive
        );

        const rows: EnrolledStudentRow[] = active.map((e) => ({
          userId: e.studentId,
          name: e.studentName,
          email: (e as any).studentEmail ?? '',
          rollNumber: e.rollNumber ?? null,
          enrollmentId: e.id,
        }));

        // Sort by roll number (numeric if possible, else alpha)
        rows.sort((a, b) => {
          const ra = parseInt(a.rollNumber ?? '', 10);
          const rb = parseInt(b.rollNumber ?? '', 10);
          if (!isNaN(ra) && !isNaN(rb)) return ra - rb;
          return (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '');
        });

        this.students.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load students');
        this.loading.set(false);
      },
    });
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  viewAdmitCard(studentId: number): void {
    this.router.navigate(['/school/exams/admit-card'], {
      queryParams: { examId: this.examId(), studentId },
    });
  }

  viewReportCard(studentId: number): void {
    this.router.navigate(['/school/exams/report-card'], {
      queryParams: { examId: this.examId(), studentId },
    });
  }

  goBack(): void {
    this.router.navigate(['/school/exams/list']);
  }

  retry(): void {
    const id = this.examId();
    if (id) this.loadData(id);
  }
}
