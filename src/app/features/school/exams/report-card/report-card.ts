// src/app/features/school/exams/report-card/report-card.ts

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ExamsService } from '../../../../core/services/exams.service';

@Component({
  selector: 'app-report-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './report-card.html',
  styleUrl: './report-card.scss',
})
export class ReportCard implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private examsService = inject(ExamsService);
  private sanitizer = inject(DomSanitizer);

  examId = signal<number | null>(null);
  studentId = signal<number | null>(null);

  loading = signal(true);
  errorType = signal<'params' | 'not_found' | 'no_enrollment' | 'no_marks' | 'server' | null>(null);
  errorMessage = signal<string | null>(null);
  cardHtml = signal<SafeHtml | null>(null);

  ngOnInit(): void {
    const rawExamId = this.route.snapshot.queryParamMap.get('examId');
    const rawStudentId = this.route.snapshot.queryParamMap.get('studentId');

    const examId = rawExamId ? parseInt(rawExamId, 10) : NaN;
    const studentId = rawStudentId ? parseInt(rawStudentId, 10) : NaN;

    // ── Frontend param validation ───────────────────────────────────────────
    if (
      !rawExamId ||
      !rawStudentId ||
      isNaN(examId) ||
      isNaN(studentId) ||
      examId <= 0 ||
      studentId <= 0
    ) {
      this.errorType.set('params');
      this.errorMessage.set(
        'This page requires a valid exam and student ID. ' +
          'Please navigate here from the Exam Cards screen.'
      );
      this.loading.set(false);
      return;
    }

    this.examId.set(examId);
    this.studentId.set(studentId);
    this.loadReportCard(examId, studentId);
  }

  loadReportCard(examId: number, studentId: number): void {
    this.loading.set(true);
    this.errorType.set(null);
    this.errorMessage.set(null);

    this.examsService.getReportCard(examId, studentId).subscribe({
      next: (res) => {
        this.cardHtml.set(this.sanitizer.bypassSecurityTrustHtml(res.html));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const msg: string = err?.error?.error || err?.message || '';

        if (err?.status === 404 || msg.toLowerCase().includes('not found')) {
          this.errorType.set('not_found');
          this.errorMessage.set('Exam or student not found. The exam may have been deleted.');
        } else if (
          msg.toLowerCase().includes('enrollment') ||
          msg.toLowerCase().includes('enrolled')
        ) {
          this.errorType.set('no_enrollment');
          this.errorMessage.set(
            'This student is not enrolled in the class-section for this exam. ' +
              'Report cards can only be generated for enrolled students.'
          );
        } else if (msg.toLowerCase().includes('marks') || msg.toLowerCase().includes('no marks')) {
          this.errorType.set('no_marks');
          this.errorMessage.set(
            'No marks have been entered for this student in this exam yet. ' +
              'Please enter marks first using the Marks Entry screen.'
          );
        } else {
          this.errorType.set('server');
          this.errorMessage.set(msg || 'An unexpected error occurred. Please try again.');
        }
      },
    });
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    const examId = this.examId();
    if (examId) {
      this.router.navigate(['/school/exams/cards', examId]);
    } else {
      this.router.navigate(['/school/exams/list']);
    }
  }

  retry(): void {
    const eid = this.examId();
    const sid = this.studentId();
    if (eid && sid) this.loadReportCard(eid, sid);
  }
}
