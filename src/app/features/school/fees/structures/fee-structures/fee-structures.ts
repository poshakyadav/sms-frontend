import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';
import { FeesService, FeeStructure } from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-fee-structures',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './fee-structures.html',
  styleUrl: './fee-structures.scss',
})
export class FeeStructures implements OnInit {
  private feesService = inject(FeesService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  structures = signal<FeeStructure[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  displayedColumns = ['classSection', 'feeType', 'amount', 'dueDate', 'mandatory', 'actions'];

  // ── PBAC flags ────────────────────────────────────────────────────────────
  canCreate = computed(() => this.auth.hasPermission('fees.structures.manage'));
  canEdit = computed(() => this.auth.hasPermission('fees.structures.manage'));
  canDelete = computed(() => this.auth.hasPermission('fees.structures.manage'));

  ngOnInit() {
    this.loadStructures();
  }

  loadStructures() {
    this.loading.set(true);
    this.error.set(null);

    this.feesService.getFeeStructures().subscribe({
      next: (res) => {
        this.structures.set(res.structures ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load fee structures');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  createNew() {
    this.router.navigate(['/school/fees/structures/new']);
  }

  edit(id: number) {
    this.router.navigate(['/school/fees/structures/edit', id]);
  }

  delete(structure: FeeStructure) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Delete Fee Structure',
          message: `Delete "${structure.feeType}" for ${structure.className} – ${structure.sectionName}? This cannot be undone.`,
          confirmText: 'Delete',
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.feesService.deleteFeeStructure(structure.id).subscribe({
          next: () => {
            this.structures.update((list) => list.filter((s) => s.id !== structure.id));
            this.toast.success('Fee structure deleted');
          },
          error: (err) =>
            this.toast.error(err?.message ?? 'Cannot delete — payments exist for this structure'),
        });
      });
  }

  getFeeTypeLabel(feeType: string): string {
    const labels: Record<string, string> = {
      TUITION: 'Tuition',
      BUS: 'Bus',
      LIBRARY: 'Library',
      EXAM_FEE: 'Exam Fee',
      ADMISSION: 'Admission',
      OTHER: 'Other',
    };
    return labels[feeType] ?? feeType;
  }
}
