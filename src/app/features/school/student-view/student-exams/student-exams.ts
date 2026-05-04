import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { HttpParams } from '@angular/common/http';

interface TimetableEntry {
  id: number;
  classSubjectId: number;
  subjectName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  roomNumber?: string;
  maxMarks: number;
  passingMarks?: number;
}

interface ExamSummary {
  id: number;
  name: string;
  type: 'MID_TERM' | 'FINAL' | 'QUIZ';
  description?: string;
  className: string;
  sectionName: string;
  timetable: TimetableEntry[];
}

interface MarkResult {
  examId: number;
  examName: string;
  examType: string;
  classSubjectId: number;
  subjectName: string;
  maxMarks: number;
  passingMarks?: number;
  marksObtained: number;
  grade?: string;
  remarks?: string;
}

interface ExamWithResults extends ExamSummary {
  results: MarkResult[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  isPassed: boolean;
}

type ViewMode = 'schedule' | 'results';

@Component({
  selector: 'app-student-exams',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './student-exams.html',
  styleUrl: './student-exams.scss',
})
export class StudentExams implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  exams = signal<ExamSummary[]>([]);
  marks = signal<MarkResult[]>([]);
  loading = signal(true);
  loadingCard = signal(false);
  error = signal<string | null>(null);

  viewMode = signal<ViewMode>('schedule');
  selectedExam = signal<ExamSummary | null>(null);
  activeTab = signal<'upcoming' | 'past'>('upcoming');

  htmlPreview = signal<string>('');
  showPreview = signal(false);
  previewType = signal<'admit-card' | 'report-card'>('admit-card');

  // ── Computed ──────────────────────────────────────────────────────────────
  today = new Date().toISOString().split('T')[0];

  upcomingExams = computed(() =>
    this.exams().filter((e) => e.timetable.some((t) => t.date >= this.today))
  );

  pastExams = computed(() =>
    this.exams().filter((e) => e.timetable.every((t) => t.date < this.today))
  );

  examsWithResults = computed((): ExamWithResults[] => {
    return this.pastExams().map((exam) => {
      const examMarks = this.marks().filter((m) => m.examId === exam.id);
      const totalObtained = examMarks.reduce((s, m) => s + (m.marksObtained ?? 0), 0);
      const totalMax = examMarks.reduce((s, m) => s + (m.maxMarks ?? 0), 0);
      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      const isPassed = examMarks.every(
        (m) => m.marksObtained >= (m.passingMarks ?? m.maxMarks * 0.33)
      );
      return { ...exam, results: examMarks, totalObtained, totalMax, percentage, isPassed };
    });
  });

  overallStats = computed(() => {
    const results = this.examsWithResults();
    if (!results.length) return null;
    const withMarks = results.filter((e) => e.results.length > 0);
    const avgPct = withMarks.length
      ? Math.round(withMarks.reduce((s, e) => s + e.percentage, 0) / withMarks.length)
      : 0;
    const passed = withMarks.filter((e) => e.isPassed).length;
    return {
      total: this.exams().length,
      upcoming: this.upcomingExams().length,
      avgPct,
      passed,
      withResults: withMarks.length,
    };
  });

  nextExam = computed(() => {
    const upcoming = this.upcomingExams();
    if (!upcoming.length) return null;
    const sorted = [...upcoming].sort((a, b) => {
      const aDate = a.timetable.map((t) => t.date).sort()[0] ?? '';
      const bDate = b.timetable.map((t) => t.date).sort()[0] ?? '';
      return aDate.localeCompare(bDate);
    });
    return sorted[0];
  });

  nextExamDate = computed(() => {
    const next = this.nextExam();
    if (!next) return null;
    const dates = next.timetable.map((t) => t.date).sort();
    return dates[0];
  });

  daysUntilNext = computed(() => {
    const date = this.nextExamDate();
    if (!date) return null;
    const diff = Math.ceil(
      (new Date(date).getTime() - new Date(this.today).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  });

  ngOnInit(): void {
    this.loadExams();
    this.loadMarks();
  }

  loadExams(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<{ exams: ExamSummary[]; enrollment: any }>('school/exams/student/my').subscribe({
      next: (res) => {
        this.exams.set(res.exams ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load exams');
        this.loading.set(false);
      },
    });
  }

  loadMarks(): void {
    this.api.get<{ marks: MarkResult[] }>('school/exams/student/my/marks').subscribe({
      next: (res) => this.marks.set(res.marks ?? []),
      error: () => {},
    });
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.selectedExam.set(null);
    this.showPreview.set(false);
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab.set(tab);
  }

  selectExam(exam: ExamSummary): void {
    this.selectedExam.set(exam);
    this.showPreview.set(false);
  }

  clearSelection(): void {
    this.selectedExam.set(null);
    this.showPreview.set(false);
  }

  getExamResults(examId: number): MarkResult[] {
    return this.marks().filter((m) => m.examId === examId);
  }

  viewAdmitCard(exam: ExamSummary): void {
    this.router.navigate(['/school/exams/student/admit-card'], {
      queryParams: { examId: exam.id },
    });
  }

  viewReportCard(exam: ExamSummary): void {
    this.router.navigate(['/school/exams/student/report-card'], {
      queryParams: { examId: exam.id },
    });
  }

  getSubjectStatus(mark: MarkResult): 'pass' | 'fail' | 'pending' {
    if (mark.marksObtained === null || mark.marksObtained === undefined) return 'pending';
    const passing = mark.passingMarks ?? mark.maxMarks * 0.33;
    return mark.marksObtained >= passing ? 'pass' : 'fail';
  }

  getPercentageClass(pct: number): string {
    if (pct >= 80) return 'excellent';
    if (pct >= 60) return 'good';
    if (pct >= 40) return 'average';
    return 'poor';
  }

  formatType(type: string): string {
    switch (type) {
      case 'MID_TERM':
        return 'Mid Term';
      case 'FINAL':
        return 'Final';
      case 'QUIZ':
        return 'Quiz';
      default:
        return type;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  formatTime(time?: string): string {
    if (!time) return '—';
    try {
      const [h, m] = time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
    } catch {
      return time;
    }
  }

  getExamFirstDate(exam: ExamSummary): string {
    const dates = exam.timetable
      .map((t) => t.date)
      .filter(Boolean)
      .sort();
    return dates[0] ?? '';
  }

  getExamLastDate(exam: ExamSummary): string {
    const dates = exam.timetable
      .map((t) => t.date)
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1] ?? '';
  }

  isDatePast(date: string): boolean {
    return date < this.today;
  }

  isDateToday(date: string): boolean {
    return date === this.today;
  }

  getCountdown(date: string): string {
    const diff = Math.ceil(
      (new Date(date).getTime() - new Date(this.today).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return 'Past';
    return `${diff} days away`;
  }
}
