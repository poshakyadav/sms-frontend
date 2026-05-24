// class-list.ts
import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { signal } from '@angular/core';
import { AcademicsService, Class } from '../../../../../core/services/academics.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-class-list',
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
  templateUrl: './class-list.html',
  styleUrl: './class-list.scss',
})
export class ClassList implements OnInit {
  private readonly academics = inject(AcademicsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // ── State ──────────────────────────────────────────────────────────────────
  classes = signal<Class[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.classes.manage'));

  readonly displayedColumns = ['name', 'level', 'sort_order', 'actions'] as const;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academics
      .getClasses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.classes.set(res.classes ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err?.message ?? 'Failed to load classes';
          this.error.set(msg);
          this.toast.error(msg);
          this.loading.set(false);
        },
      });
  }

  edit(cls: Class): void {
    this.router.navigate(['/school/academics/classes/edit', cls.id]);
  }

  delete(cls: Class): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: `Delete "${cls.name}"?`,
        message: 'This will remove the class and all related sections. This cannot be undone.',
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

        this.academics.deleteClass(cls.id).subscribe({
          next: () => {
            this.classes.update((list) => list.filter((c) => c.id !== cls.id));
            this.toast.success(`"${cls.name}" deleted`);
          },
          error: (err) => this.toast.error(err?.message ?? 'Failed to delete class'),
        });
      });
  }

  trackById(_index: number, cls: Class): number {
    return cls.id;
  }
}
