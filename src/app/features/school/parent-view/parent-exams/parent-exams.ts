import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ParentService } from '../../../../core/services/parent.service';
import { ToastService } from '../../../../core/services/toast.service';

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
  hasResults: boolean;
}

type ActiveSection = 'overview' | 'schedule' | 'results';

@Component({
  selector: 'app-parent-exams',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './parent-exams.html',
  styleUrl: './parent-exams.scss',
})
export class ParentExams implements OnInit {
  private api = inject(ApiService);
  private parentService = inject(ParentService);
  private toast = inject(ToastService);
  private router = inject(Router);

  exams = signal<ExamSummary[]>([]);
  marks = signal<MarkResult[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  activeSection = signal<ActiveSection>('overview');
  selectedExam = signal<ExamWithResults | null>(null);
  expandedResultId = signal<number | null>(null);

  activeChild = computed(() => this.parentService.activeChild());
  activeChildId = computed(() => this.parentService.activeChildId());

  today = new Date().toISOString().split('T')[0];

  // ── Computed ──────────────────────────────────────────────────────────────
  upcomingExams = computed(() =>
    this.exams().filter((e) => e.timetable.some((t) => t.date >= this.today))
  );

  pastExams = computed(() =>
    this.exams().filter((e) => e.timetable.every((t) => t.date < this.today))
  );

  allExamsWithResults = computed((): ExamWithResults[] =>
    this.exams().map((exam) => {
      const results = this.marks().filter((m) => m.examId === exam.id);
      const totalObtained = results.reduce((s, m) => s + (m.marksObtained ?? 0), 0);
      const totalMax = results.reduce((s, m) => s + (m.maxMarks ?? 0), 0);
      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      const isPassed =
        results.length > 0 &&
        results.every((m) => m.marksObtained >= (m.passingMarks ?? m.maxMarks * 0.33));
      return {
        ...exam,
        results,
        totalObtained,
        totalMax,
        percentage,
        isPassed,
        hasResults: results.length > 0,
      };
    })
  );

  upcomingWithResults = computed(() =>
    this.allExamsWithResults().filter((e) => e.timetable.some((t) => t.date >= this.today))
  );

  pastWithResults = computed(() =>
    this.allExamsWithResults().filter((e) => e.timetable.every((t) => t.date < this.today))
  );

  // ── Pre-filtered computed signals (replaces .filter() calls in template) ──
  // Angular's template compiler bans arrow functions (=> is treated as assignment).
  // All .filter(e => ...) calls must live here in the class, not in the HTML.
  examsWithResultsOnly = computed(() => this.pastWithResults().filter((e) => e.hasResults));

  recentResultsPreview = computed(() =>
    this.pastWithResults()
      .filter((e) => e.hasResults)
      .slice(0, 4)
  );

  hasAnyResults = computed(() => this.pastWithResults().some((e) => e.hasResults));

  resultsCount = computed(() => this.pastWithResults().filter((e) => e.hasResults).length);

  // ── Performance summary ───────────────────────────────────────────────────
  performanceSummary = computed(() => {
    const completed = this.examsWithResultsOnly();
    if (!completed.length) return null;

    const avgPct = Math.round(completed.reduce((s, e) => s + e.percentage, 0) / completed.length);
    const passed = completed.filter((e) => e.isPassed).length;
    const best = [...completed].sort((a, b) => b.percentage - a.percentage)[0];
    const worst = [...completed].sort((a, b) => a.percentage - b.percentage)[0];

    const allMarks = this.marks();
    const subjectMap = new Map<string, { total: number; max: number; count: number }>();
    allMarks.forEach((m) => {
      const entry = subjectMap.get(m.subjectName) ?? { total: 0, max: 0, count: 0 };
      entry.total += m.marksObtained;
      entry.max += m.maxMarks;
      entry.count++;
      subjectMap.set(m.subjectName, entry);
    });
    let bestSubject: string | null = null;
    let bestPct = 0;
    subjectMap.forEach((v, k) => {
      const pct = v.max > 0 ? (v.total / v.max) * 100 : 0;
      if (pct > bestPct) {
        bestPct = pct;
        bestSubject = k;
      }
    });

    return {
      total: this.exams().length,
      upcoming: this.upcomingExams().length,
      completed: completed.length,
      passed,
      avgPct,
      best,
      worst,
      bestSubject,
      bestSubjectPct: Math.round(bestPct),
    };
  });

  nextExam = computed(() => {
    const upcoming = this.upcomingWithResults();
    if (!upcoming.length) return null;
    return [...upcoming].sort((a, b) => {
      const aD = a.timetable.map((t) => t.date).sort()[0] ?? '';
      const bD = b.timetable.map((t) => t.date).sort()[0] ?? '';
      return aD.localeCompare(bD);
    })[0];
  });

  ngOnInit(): void {
    if (!this.activeChildId()) {
      this.error.set('No child selected. Please select a child to view their exam details.');
      this.loading.set(false);
      return;
    }
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<{ exams: ExamSummary[] }>('school/exams/parent/child').subscribe({
      next: (res) => {
        this.exams.set(res.exams ?? []);
        this.loadMarks();
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load exam data');
        this.loading.set(false);
      },
    });
  }

  loadMarks(): void {
    this.api.get<{ marks: MarkResult[] }>('school/exams/parent/child/marks').subscribe({
      next: (res) => {
        this.marks.set(res.marks ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  setSection(section: ActiveSection): void {
    this.activeSection.set(section);
    this.selectedExam.set(null);
  }

  selectExam(exam: ExamWithResults): void {
    this.selectedExam.set(exam);
    this.activeSection.set('schedule');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearExam(): void {
    this.selectedExam.set(null);
  }

  toggleResultExpand(id: number): void {
    this.expandedResultId.set(this.expandedResultId() === id ? null : id);
  }

  // ── Replaces the inline filter(r => r.classSubjectId === entry.classSubjectId)
  // that was inside @let in the template. Methods with parameters are allowed;
  // arrow functions inside template expressions are not.
  getSubjectResults(exam: ExamWithResults, classSubjectId: number): MarkResult[] {
    return exam.results.filter((r) => r.classSubjectId === classSubjectId);
  }

  getFirstSubjectResult(exam: ExamWithResults, classSubjectId: number): MarkResult | undefined {
    return exam.results.find((r) => r.classSubjectId === classSubjectId);
  }

  viewAdmitCard(exam: ExamSummary): void {
    this.router.navigate(['/school/exams/parent/admit-card'], {
      queryParams: { examId: exam.id },
    });
  }

  viewReportCard(exam: ExamSummary): void {
    this.router.navigate(['/school/exams/parent/report-card'], {
      queryParams: { examId: exam.id },
    });
  }

  getSubjectStatus(mark: MarkResult): 'pass' | 'fail' | 'pending' {
    if (mark.marksObtained === null || mark.marksObtained === undefined) return 'pending';
    const passing = mark.passingMarks ?? mark.maxMarks * 0.33;
    return mark.marksObtained >= passing ? 'pass' : 'fail';
  }

  getGradeColor(pct: number): string {
    if (pct >= 90) return 'outstanding';
    if (pct >= 75) return 'excellent';
    if (pct >= 60) return 'good';
    if (pct >= 45) return 'average';
    return 'poor';
  }

  getGradeLabel(pct: number): string {
    if (pct >= 90) return 'Outstanding';
    if (pct >= 75) return 'Excellent';
    if (pct >= 60) return 'Good';
    if (pct >= 45) return 'Average';
    return 'Needs Improvement';
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

  formatDay(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });
    } catch {
      return '';
    }
  }

  formatTime(time?: string): string {
    if (!time) return '—';
    try {
      const [h, m] = time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
    } catch {
      return time;
    }
  }

  getExamFirstDate(exam: ExamSummary): string {
    return (
      exam.timetable
        .map((t) => t.date)
        .filter(Boolean)
        .sort()[0] ?? ''
    );
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

  daysUntil(date: string): number {
    return Math.ceil(
      (new Date(date).getTime() - new Date(this.today).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  getCountdownLabel(date: string): string {
    const d = this.daysUntil(date);
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d < 0) return 'Completed';
    return `${d} days`;
  }

  getChildInitials(): string {
    const child = this.activeChild();
    if (!child?.studentName) return '?';
    return child.studentName
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
