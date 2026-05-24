// class-sections-list.ts  (UPDATED — adds bulk-create / bulk-edit navigation)
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AcademicsService, ClassSection } from '../../../../../core/services/academics.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-class-sections-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './class-sections-list.html',
  styleUrl: './class-sections-list.scss',
})
export class ClassSectionsList implements OnInit {
  private readonly academics = inject(AcademicsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayedColumns = [
    'className',
    'sectionName',
    'capacity',
    'enrolled',
    'roomNumber',
    'classTeacherName',
    'status',
    'actions',
  ] as const;

  classSections = signal<ClassSection[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.classes.manage'));

  ngOnInit(): void {
    this.loadClassSections();
  }

  loadClassSections(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academics
      .getClassSections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.classSections.set(res.classSections ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err?.message ?? 'Failed to load class-sections';
          this.error.set(msg);
          this.toast.error(msg);
          this.loading.set(false);
        },
      });
  }

  edit(cs: ClassSection): void {
    this.router.navigate(['/school/academics/class-sections/edit', cs.id]);
  }

  delete(cs: ClassSection): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: `Delete "${cs.className} – ${cs.sectionName}"?`,
        message:
          'This will remove the class-section. Students must have no active enrollments first.',
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

        this.academics.deleteClassSection(cs.id).subscribe({
          next: () => {
            this.classSections.update((list) => list.filter((s) => s.id !== cs.id));
            this.toast.success(`"${cs.className} – ${cs.sectionName}" deleted`);
          },
          error: (err) => this.toast.error(err?.message ?? 'Failed to delete class-section'),
        });
      });
  }

  trackById(_index: number, cs: ClassSection): number {
    return cs.id;
  }
}
