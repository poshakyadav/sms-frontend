// features/school/fees/fee-structures/fee-structures-list/fee-structures-list.ts
import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';
import { FeesService, FeeStructure } from '../../../../../core/services/fees.service';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { BulkMonthlyStructureFormComponent } from '../bulk-monthly-structure-form/bulk-monthly-structure-form';
import { FeeStructureFormComponent } from '../fee-structure-form/fee-structure-form';


@Component({
  selector: 'app-fee-structures-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    PaisePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-structures-list.html',
  styleUrl: './fee-structures-list.scss',
})
export class FeeStructuresList implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  structures = signal<FeeStructure[]>([]);

  // Filters
  filterClass = signal('');
  filterFeeType = signal('');
  filterAcademicYear = signal<number | null>(null);

  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);

  filteredStructures = computed(() => {
    let list = this.structures();
    const cls = this.filterClass().trim().toLowerCase();
    const ft = this.filterFeeType().trim().toLowerCase();
    if (cls)
      list = list.filter(
        (s) => s.className.toLowerCase().includes(cls) || s.sectionName.toLowerCase().includes(cls)
      );
    if (ft) list = list.filter((s) => s.feeType.toLowerCase().includes(ft));
    return list;
  });

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadStructures();
    this.loadAcademicYears();
  }

  loadStructures(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getFeeStructures().subscribe({
      next: (list) => {
        this.structures.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load fee structures');
        this.loading.set(false);
      },
    });
  }

  loadAcademicYears(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years),
    });
  }

  openAddForm(): void {
    const ref = this.dialog.open(FeeStructureFormComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: { mode: 'create' },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadStructures();
        this.snack.open('Fee structure created', 'Close', { duration: 3000 });
      }
    });
  }

  openEditForm(structure: FeeStructure): void {
    const ref = this.dialog.open(FeeStructureFormComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
      data: { mode: 'edit', structure },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadStructures();
        this.snack.open('Fee structure updated', 'Close', { duration: 3000 });
      }
    });
  }

  openBulkForm(): void {
    const ref = this.dialog.open(BulkMonthlyStructureFormComponent, {
      width: '620px',
      maxWidth: '95vw',
      panelClass: 'side-sheet-dialog',
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadStructures();
        this.snack.open(`Bulk fee structures created`, 'Close', {
          duration: 3500,
        });
      }
    });
  }

  deleteStructure(structure: FeeStructure): void {
    if (
      !confirm(
        `Delete fee structure "${structure.feeType}" for ${structure.className}-${structure.sectionName}? This cannot be undone.`
      )
    )
      return;

    this.fees.deleteFeeStructure(structure.id).subscribe({
      next: () => {
        this.structures.update((list) => list.filter((s) => s.id !== structure.id));
        this.snack.open('Fee structure deleted', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.snack.open(err?.error?.error ?? 'Cannot delete — payments exist', 'Close', {
          duration: 4000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  trackById(_: number, item: FeeStructure): number {
    return item.id;
  }
}
