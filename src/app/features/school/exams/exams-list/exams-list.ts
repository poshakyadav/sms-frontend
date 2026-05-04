// exams-list.ts

import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { Exam, ExamStatus, ExamsService } from '../../../../core/services/exams.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-exams-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './exams-list.html',
  styleUrl: './exams-list.scss',
})
export class ExamsList implements OnInit {
  private examsService = inject(ExamsService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);

  exams = signal<Exam[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Track which exam is having a status/publish action in-flight
  actionInProgress = signal<number | null>(null);

  displayedColumns = ['name', 'classSection', 'type', 'status', 'cards', 'subjects', 'viewCards', 'actions'];

  // ── PBAC permission flags ─────────────────────────────────────────────────
  canCreate = computed(() => this.auth.hasPermission('exams.create'));
  canEdit = computed(() => this.auth.hasPermission('exams.edit'));
  canDelete = computed(() => this.auth.hasPermission('exams.edit'));
  canMarks = computed(() => this.auth.hasPermission('exams.marks.enter'));
  canTemplates = computed(() => this.auth.hasPermission('exams.templates.manage'));
  canManageStatus = computed(() => this.auth.hasPermission('exams.status.manage'));
  canPublishAdmit = computed(() => this.auth.hasPermission('exams.admit-card.publish'));
  canPublishReport = computed(() => this.auth.hasPermission('exams.report-card.publish'));
  canPublishAny = computed(() => this.canPublishAdmit() || this.canPublishReport());

  // Stat signals
  totalExams = computed(() => this.exams().length);
  scheduledCount = computed(() => this.exams().filter((e) => e.status === 'SCHEDULED').length);
  activeCount = computed(() => this.exams().filter((e) => e.status === 'ACTIVE').length);
  completedCount = computed(() => this.exams().filter((e) => e.status === 'COMPLETED').length);

  ngOnInit(): void {
    this.loadExams();
  }

  loadExams(): void {
    this.loading.set(true);
    this.error.set(null);
    this.examsService.getExams().subscribe({
      next: (list) => {
        this.exams.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load exams');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  createNew(): void {
    this.router.navigate(['/school/exams/new']);
  }

  edit(id: number): void {
    this.router.navigate(['/school/exams/edit', id]);
  }

  enterMarks(id: number): void {
    this.router.navigate(['/school/exams/marks', id]);
  }

  delete(exam: Exam): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Delete Exam',
        message: `Delete "${exam.name}"? This cannot be undone. Exams with marks entered cannot be deleted.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.examsService.deleteExam(exam.id).subscribe({
        next: () => {
          this.exams.update((list) => list.filter((e) => e.id !== exam.id));
          this.toast.success('Exam deleted');
        },
        error: (err) => this.toast.error(err?.message || 'Cannot delete exam with marks'),
      });
    });
  }

  // ── Feature 2: Status management ─────────────────────────────────────────

  updateStatus(exam: Exam, status: ExamStatus): void {
    if (this.actionInProgress() !== null) return;
    this.actionInProgress.set(exam.id);

    this.examsService.updateStatus(exam.id, status).subscribe({
      next: (res) => {
        this.exams.update((list) =>
          list.map((e) => (e.id === exam.id ? { ...e, status: res.exam.status } : e))
        );
        this.toast.success(`Exam marked as ${status.toLowerCase()}`);
        this.actionInProgress.set(null);
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Failed to update status');
        this.actionInProgress.set(null);
      },
    });
  }

  // ── Feature 1: Card publication ───────────────────────────────────────────

  togglePublish(exam: Exam, cardType: 'ADMIT_CARD' | 'REPORT_CARD'): void {
    if (this.actionInProgress() !== null) return;

    const isAdmit = cardType === 'ADMIT_CARD';
    const currentState = isAdmit ? exam.admitCardPublished : exam.reportCardPublished;
    const label = isAdmit ? 'admit card' : 'report card';
    const action = currentState ? 'unpublish' : 'publish';

    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${label}`,
        message: currentState
          ? `Students and parents will no longer be able to see the ${label} for "${exam.name}".`
          : `Students and parents will now be able to see and download the ${label} for "${exam.name}".`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        confirmColor: currentState ? 'warn' : 'primary',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.actionInProgress.set(exam.id);

      this.examsService.publishCard(exam.id, cardType, !currentState).subscribe({
        next: (res) => {
          this.exams.update((list) =>
            list.map((e) =>
              e.id === exam.id
                ? {
                    ...e,
                    admitCardPublished: res.exam.admitCardPublished,
                    reportCardPublished: res.exam.reportCardPublished,
                  }
                : e
            )
          );
          this.toast.success(
            `${label.charAt(0).toUpperCase() + label.slice(1)} ${
              !currentState ? 'published' : 'unpublished'
            }`
          );
          this.actionInProgress.set(null);
        },
        error: (err) => {
          this.toast.error(err?.error?.error || 'Action failed');
          this.actionInProgress.set(null);
        },
      });
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  examTypeBadgeClass(type: string): string {
    const normalized = type.toLowerCase().replace(/\s+/g, '-');
    if (normalized.includes('mid')) return 'mid-term';
    if (normalized.includes('final') || normalized.includes('annual')) return 'final';
    if (normalized.includes('quiz') || normalized.includes('unit')) return 'quiz';
    return 'custom';
  }

  statusClass(status: ExamStatus): string {
    switch (status) {
      case 'SCHEDULED':
        return 'status-scheduled';
      case 'ACTIVE':
        return 'status-active';
      case 'COMPLETED':
        return 'status-completed';
      default:
        return '';
    }
  }

  statusIcon(status: ExamStatus): string {
    switch (status) {
      case 'SCHEDULED':
        return 'event';
      case 'ACTIVE':
        return 'play_circle';
      case 'COMPLETED':
        return 'check_circle';
      default:
        return 'help';
    }
  }

  nextStatuses(current: ExamStatus): { label: string; value: ExamStatus }[] {
    switch (current) {
      case 'SCHEDULED':
        return [{ label: 'Mark Active', value: 'ACTIVE' }];
      case 'ACTIVE':
        return [
          { label: 'Mark Completed', value: 'COMPLETED' },
          { label: 'Back to Scheduled', value: 'SCHEDULED' },
        ];
      case 'COMPLETED':
        return [{ label: 'Reopen as Active', value: 'ACTIVE' }];
      default:
        return [];
    }
  }

  viewCards(examId: number): void {
    this.router.navigate(['/school/exams/cards', examId]);
  }

}
