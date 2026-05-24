import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SchoolSubject, SubjectsService } from '../../../../../core/services/subjects.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-subjects-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink, 
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './subjects-list.html',
  styleUrl: './subjects-list.scss',
})
export class SubjectsList implements OnInit {
  private readonly subjectsService = inject(SubjectsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  allSubjects = signal<SchoolSubject[]>([]);
  searchTerm = signal('');
  loading = signal(true);
  error = signal<string | null>(null);

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.subjects.manage'));
  canAssignTeacher = computed(() => this.auth.hasPermission('academics.assign-teacher'));

  // ── Derived filtered list ─────────────────────────────────────────────────
  filteredSubjects = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.allSubjects();
    return this.allSubjects().filter(
      (s) => s.name.toLowerCase().includes(term) || (s.code && s.code.toLowerCase().includes(term))
    );
  });

  readonly displayedColumns = ['name', 'code', 'description', 'actions'] as const;

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.loading.set(true);
    this.error.set(null);

    this.subjectsService
      .getSubjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.allSubjects.set(res.subjects ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err?.message ?? 'Failed to load subjects';
          this.error.set(msg);
          this.toast.error(msg);
          this.loading.set(false);
        },
      });
  }

  /**
   * Navigate to the class-section assignment page.
   * The route /school/academics/subjects/assign-class/:classId receives
   * the SUBJECT id so the page can pre-select it. This keeps the flow
   * intuitive: "pick a subject → pick which class-section to assign it to".
   */
  navigateToAssign(subject: SchoolSubject): void {
    this.router.navigate(['/school/academics/subjects/assign-class', subject.id]);
  }

  delete(subject: SchoolSubject): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: `Delete "${subject.name}"?`,
        message:
          'This subject will be removed. It cannot be deleted if already assigned to any class-section.',
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
      width: '420px',
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.subjectsService.deleteSubject(subject.id).subscribe({
          next: () => {
            this.allSubjects.update((l) => l.filter((s) => s.id !== subject.id));
            this.toast.success(`"${subject.name}" deleted`);
          },
          error: (err) => this.toast.error(err?.message ?? 'Cannot delete — subject may be in use'),
        });
      });
  }

  trackById(_index: number, s: SchoolSubject): number {
    return s.id;
  }
}
