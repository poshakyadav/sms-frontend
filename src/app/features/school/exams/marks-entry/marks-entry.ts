import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamsService } from '../../../../core/services/exams.service';
import { SubjectsService } from '../../../../core/services/subjects.service';
import { ToastService } from '../../../../core/services/toast.service';

interface MarkRow {
  enrollmentId: number;
  studentName: string;
  rollNumber: string;
  marksObtained: number | null;
  grade: string;
  remarks: string;
  dirty: boolean;
}

@Component({
  selector: 'app-marks-entry',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
  ],
  templateUrl: './marks-entry.html',
  styleUrl: './marks-entry.scss',
})
export class MarksEntry implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private examsService = inject(ExamsService);
  private subjectsService = inject(SubjectsService);
  private toast = inject(ToastService);

  examId = Number(this.route.snapshot.paramMap.get('examId'));

  exam = signal<any>(null);
  subjects = signal<any[]>([]);
  marks = signal<MarkRow[]>([]);
  selectedSubjectId = signal<number | null>(null);

  loading = signal(true);
  saving = signal(false);

  hasChanges = computed(() => this.marks().some((m) => m.dirty));

  displayedColumns = ['index', 'student', 'marks', 'grade', 'remarks', 'actions'];

  // Stats
  totalStudents = computed(() => this.marks().length);
  enteredCount = computed(() => this.marks().filter((m) => m.marksObtained !== null).length);
  pendingCount = computed(() => this.totalStudents() - this.enteredCount());
  classAverage = computed(() => {
    const entered = this.marks().filter((m) => m.marksObtained !== null);
    if (!entered.length) return 0;
    return Math.round(entered.reduce((sum, m) => sum + (m.marksObtained ?? 0), 0) / entered.length);
  });

  ngOnInit(): void {
    if (isNaN(this.examId)) {
      this.toast.error('Invalid exam ID');
      this.router.navigate(['/school/exams/list']);
      return;
    }
    this.loadExamAndData();
  }

  private loadExamAndData(): void {
    this.loading.set(true);

    this.examsService.getById(this.examId).subscribe({
      next: (examData) => {
        this.exam.set(examData);

        this.subjectsService.getClassSectionSubjects(examData.classSectionId).subscribe({
          next: (res) => {
            const subs = res.subjects ?? [];
            this.subjects.set(subs);
            if (subs.length > 0) {
              this.selectedSubjectId.set(subs[0].id);
              this.loadMarks();
            } else {
              this.loading.set(false);
            }
          },
          error: () => {
            this.toast.error('Failed to load subjects');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.toast.error('Failed to load exam');
        this.router.navigate(['/school/exams/list']);
      },
    });
  }

  private loadMarks(): void {
    this.loading.set(true);
    const subjectId = this.selectedSubjectId();
    if (!subjectId) {
      this.loading.set(false);
      return;
    }

    this.examsService.getMarksByStudent(0, this.examId).subscribe({
      next: (res) => {
        const filtered = (res.marks ?? []).filter((m: any) => m.classSubjectId === subjectId);

        this.marks.set(
          filtered.map((m: any) => ({
            enrollmentId: m.enrollmentId,
            studentName: m.studentName ?? 'Unknown',
            rollNumber: m.rollNumber ?? '—',
            marksObtained: m.marksObtained ?? null,
            grade: m.grade ?? '',
            remarks: m.remarks ?? '',
            dirty: false,
          }))
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to load marks');
        this.loading.set(false);
      },
    });
  }

  onSubjectChange(newId: number | null): void {
    this.selectedSubjectId.set(newId);
    this.loadMarks();
  }

  markDirty(row: MarkRow): void {
    row.dirty = true;
    // trigger signal update
    this.marks.update((m) => [...m]);
  }

  saveRow(row: MarkRow): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return;

    const payload = {
      examId: this.examId,
      classSubjectId: subjectId,
      marks: [
        {
          enrollmentId: row.enrollmentId,
          marksObtained: row.marksObtained ?? 0,
          grade: row.grade ?? '',
          remarks: row.remarks ?? '',
        },
      ],
    };

    this.examsService.enterMarks(payload).subscribe({
      next: () => {
        row.dirty = false;
        this.marks.update((m) => [...m]);
        this.toast.success('Saved');
      },
      error: (err) => this.toast.error(err?.message ?? 'Save failed'),
    });
  }

  saveAll(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || !this.hasChanges()) return;

    this.saving.set(true);

    const payload = {
      examId: this.examId,
      classSubjectId: subjectId,
      marks: this.marks().map((row) => ({
        enrollmentId: row.enrollmentId,
        marksObtained: row.marksObtained ?? 0,
        grade: row.grade ?? '',
        remarks: row.remarks ?? '',
      })),
    };

    this.examsService.enterMarks(payload).subscribe({
      next: () => {
        this.toast.success('All marks saved!');
        this.marks.update((rows) => rows.map((r) => ({ ...r, dirty: false })));
        this.saving.set(false);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save marks');
        this.saving.set(false);
      },
    });
  }
}
