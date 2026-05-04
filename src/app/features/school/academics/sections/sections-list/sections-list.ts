import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { AcademicsService, Section } from '../../../../../core/services/academics.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-sections-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule, // ← ADDED: provides routerLink directive used in the template
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './sections-list.html',
  styleUrl: './sections-list.scss',
})
export class SectionsList {
  private academics = inject(AcademicsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  displayedColumns = ['name', 'actions'];
  sections = signal<Section[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.sections.manage'));

  constructor() {
    this.loadSections();
  }

  loadSections(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academics.getSections().subscribe({
      next: (res) => {
        this.sections.set(res.sections ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load sections');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  delete(section: Section): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: `Delete section "${section.name}"?`,
        message: 'This will affect all class-sections and enrolled students using this section.',
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.academics.deleteSection(section.id).subscribe({
        next: () => {
          this.sections.update((l) => l.filter((s) => s.id !== section.id));
          this.toast.success('Section deleted');
        },
        error: (err) => this.toast.error(err?.message ?? 'Failed to delete section'),
      });
    });
  }

  trackById(_: number, s: Section): number {
    return s.id;
  }
}
