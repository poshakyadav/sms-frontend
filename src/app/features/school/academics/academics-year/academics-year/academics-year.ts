import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AcademicsService, AcademicYear } from '../../../../../core/services/academics.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-academics-year',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
    MatChipsModule,
  ],
  templateUrl: './academics-year.html',
  styleUrl: './academics-year.scss',
})
export class AcademicsYear implements OnInit {
  private service = inject(AcademicsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  years = signal<AcademicYear[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  activatingId = signal<number | null>(null);

  displayedColumns = ['name', 'startDate', 'endDate', 'status', 'actions'];

  // ── PBAC: permission-based computed flags ─────────────────────────────────
  canCreate = computed(() => this.auth.hasPermission('academics.years.manage'));
  canEdit = computed(() => this.auth.hasPermission('academics.years.manage'));
  canDelete = computed(() => this.auth.hasPermission('academics.years.manage'));
  canActivate = computed(() => this.auth.hasPermission('academics.years.manage'));

  // ── Computed: currently active year ──────────────────────────────────────
  currentYear = computed(() => this.years().find((y) => y.isCurrent) ?? null);

  ngOnInit(): void {
    this.loadYears();
  }

  loadYears(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getAcademicYears().subscribe({
      next: (res) => {
        this.years.set(res.years ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load academic years');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  edit(year: AcademicYear): void {
    this.router.navigate(['/school/academics/years/edit', year.id]);
  }

  activate(year: AcademicYear): void {
    const current = this.currentYear();
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Switch Active Academic Year',
        message: current
          ? `This will deactivate <strong>${current.name}</strong> and make <strong>${year.name}</strong> the current year.\n\nAll new enrollments, attendance, fees, and exams will be recorded under <strong>${year.name}</strong>. Existing data in the previous year remains intact.`
          : `Make <strong>${year.name}</strong> the current academic year?`,
        confirmText: 'Yes, Activate',
        confirmColor: 'primary',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.activatingId.set(year.id);

      this.service.activateAcademicYear(year.id).subscribe({
        next: (res) => {
          // Update local signal — flip isCurrent flags without a full reload
          this.years.update((list) => list.map((y) => ({ ...y, isCurrent: y.id === year.id })));
          this.toast.success(res.message ?? `"${year.name}" is now active`);
          this.activatingId.set(null);
        },
        error: (err) => {
          this.toast.error(err?.message ?? 'Failed to activate year');
          this.activatingId.set(null);
        },
      });
    });
  }

  delete(id: number): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Delete Academic Year',
        message: 'This cannot be undone. All associated data will be affected.',
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.deleteAcademicYear(id).subscribe({
        next: () => {
          this.years.update((l) => l.filter((y) => y.id !== id));
          this.toast.success('Year deleted');
        },
        error: (err) => this.toast.error(err?.message ?? 'Failed to delete year'),
      });
    });
  }
}
