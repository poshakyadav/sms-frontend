// assignment-submissions-component.ts

import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AssignmentsService,
  SubmissionRow,
  SubmissionsReport,
} from '../../../../core/services/assignments.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-assignment-submissions-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './assignment-submissions-component.html',
  styleUrl: './assignment-submissions-component.scss',
})
export class AssignmentSubmissionsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(AssignmentsService);
  private toast = inject(ToastService);

  assignmentId = Number(this.route.snapshot.paramMap.get('id'));

  // ── State ──────────────────────────────────────────────────────────────────
  submissions = signal<SubmissionRow[]>([]);
  aggregates = signal<SubmissionsReport['aggregates'] | null>(null);
  loading = signal(true);
  saving = signal(false);
  hasChanges = signal(false);

  displayedColumns = ['student', 'studentStatus', 'teacherStatus', 'marks', 'remarks', 'rowAction'];

  // ── Computed: track how many are graded for progress bar ─────────────────
  gradedCount = computed(
    () => this.submissions().filter((s) => s.teacherStatus === 'GRADED').length
  );

  progressPercent = computed(() => {
    const total = this.submissions().length;
    return total > 0 ? Math.round((this.gradedCount() / total) * 100) : 0;
  });

  ngOnInit(): void {
    if (isNaN(this.assignmentId) || this.assignmentId <= 0) {
      this.toast.error('Invalid assignment ID');
      this.router.navigate(['/school/assignments/list']);
      return;
    }
    this.loadSubmissions();
  }

  loadSubmissions(): void {
    this.loading.set(true);
    this.service.getSubmissionsReport(this.assignmentId).subscribe({
      next: (res) => {
        this.submissions.set(res.report ?? []);
        this.aggregates.set(res.aggregates ?? null);
        this.hasChanges.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to load submissions');
        this.loading.set(false);
      },
    });
  }

  onChange(): void {
    this.hasChanges.set(true);
  }

  saveRow(row: SubmissionRow): void {
    this.service
      .recordSubmissions({
        assignmentId: this.assignmentId,
        submissions: [
          {
            enrollmentId: row.enrollmentId,
            teacherStatus: row.teacherStatus,
            marksObtained: row.marksObtained ?? null,
            remarks: row.remarks ?? '',
          },
        ],
      })
      .subscribe({
        next: () => {
          this.toast.success('Row saved');
          this.loadSubmissions();
        },
        error: (err) => this.toast.error(err?.message ?? 'Failed to save row'),
      });
  }

  saveAll(): void {
    if (!this.hasChanges()) return;

    this.saving.set(true);
    this.service
      .recordSubmissions({
        assignmentId: this.assignmentId,
        submissions: this.submissions().map((row) => ({
          enrollmentId: row.enrollmentId,
          teacherStatus: row.teacherStatus,
          marksObtained: row.marksObtained ?? null,
          remarks: row.remarks ?? '',
        })),
      })
      .subscribe({
        next: () => {
          this.toast.success('All changes saved successfully');
          this.hasChanges.set(false);
          this.saving.set(false);
          this.loadSubmissions();
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to save changes');
          this.saving.set(false);
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/school/assignments/list']);
  }

  getStudentStatusClass(status: string): string {
    return status === 'MARKED_AS_DONE' ? 'done' : 'pending';
  }

  getStudentStatusLabel(status: string): string {
    return status === 'MARKED_AS_DONE' ? 'Submitted' : 'Pending';
  }

  getTeacherStatusClass(status: string): string {
    switch (status) {
      case 'GRADED':
        return 'graded';
      case 'RECEIVED':
        return 'received';
      case 'NOT_RECEIVED':
        return 'not-received';
      default:
        return '';
    }
  }

  trackByEnrollment(_: number, row: SubmissionRow): number {
    return row.enrollmentId;
  }
}
