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
import {
  AcademicsService,
  AcademicYear,
  ClassSection,
} from '../../../../../core/services/academics.service';
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

  // ── Filter state ───────────────────────────────────────────────────────────
  filterText = signal('');
  filterFeeType = signal('');
  filterAcademicYearId = signal<number | null>(null);
  filterClassSectionId = signal<number | null>(null);

  // ── Reference data ─────────────────────────────────────────────────────────
  academicYears = signal<AcademicYear[]>([]);
  classSections = signal<ClassSection[]>([]);

  // ── Derived: unique fee types for the quick-filter chips ──────────────────
  uniqueFeeTypes = computed(() => {
    const types = new Set(this.structures().map((s) => s.feeType));
    return Array.from(types).sort();
  });

  // ── Derived: class-sections that actually exist in loaded structures ───────
  // Only show class-sections relevant to the selected academic year so the
  // class-section dropdown stays meaningful.
  filteredClassSectionOptions = computed<ClassSection[]>(() => {
    const yearId = this.filterAcademicYearId();
    const allSections = this.classSections();

    if (!yearId) return allSections;

    const idsInYear = new Set(
      this.structures()
        .filter((s) => s.academicYearId === yearId)
        .map((s) => s.classSectionId)
    );

    return allSections.filter((cs) => idsInYear.has(cs.id));
  });

  // ── Master computed filter ─────────────────────────────────────────────────
  filteredStructures = computed(() => {
    let list = this.structures();

    const yearId = this.filterAcademicYearId();
    if (yearId !== null) {
      list = list.filter((s) => s.academicYearId === yearId);
    }

    const sectionId = this.filterClassSectionId();
    if (sectionId !== null) {
      list = list.filter((s) => s.classSectionId === sectionId);
    }

    const text = this.filterText().trim().toLowerCase();
    if (text) {
      list = list.filter(
        (s) =>
          s.className.toLowerCase().includes(text) ||
          s.sectionName.toLowerCase().includes(text) ||
          s.feeType.toLowerCase().includes(text) ||
          (s.description ?? '').toLowerCase().includes(text)
      );
    }

    const feeType = this.filterFeeType();
    if (feeType) {
      list = list.filter((s) => s.feeType === feeType);
    }

    return list;
  });

  // ── Summary totals for the active filter view ──────────────────────────────
  filterSummary = computed(() => {
    const list = this.filteredStructures();
    const total = list.reduce((sum, s) => sum + s.amount, 0);
    const mandatory = list.filter((s) => s.isMandatory).length;
    return { count: list.length, total, mandatory };
  });

  hasActiveFilters = computed(
    () =>
      this.filterAcademicYearId() !== null ||
      this.filterClassSectionId() !== null ||
      this.filterText().trim() !== '' ||
      this.filterFeeType() !== ''
  );

  constructor(
    private fees: FeesService,
    private academics: AcademicsService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadReferenceData();
    this.loadStructures();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private loadReferenceData(): void {
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years);
        // Auto-select current academic year on load
        const current = res.years.find((y) => y.isCurrent);
        if (current) {
          this.filterAcademicYearId.set(current.id);
        }
      },
    });

    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });
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

  // ── Filter actions ─────────────────────────────────────────────────────────

  onAcademicYearChange(yearId: number | null): void {
    this.filterAcademicYearId.set(yearId);
    // Reset class-section when year changes — it may no longer be valid
    this.filterClassSectionId.set(null);
  }

  onFeeTypeChipClick(feeType: string): void {
    // Toggle: clicking the active chip clears it
    this.filterFeeType.set(this.filterFeeType() === feeType ? '' : feeType);
  }

  clearAllFilters(): void {
    this.filterText.set('');
    this.filterFeeType.set('');
    this.filterAcademicYearId.set(null);
    this.filterClassSectionId.set(null);
  }

  // ── Dialog openers ─────────────────────────────────────────────────────────

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
        this.snack.open('Bulk fee structures created', 'Close', { duration: 3500 });
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

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  getAcademicYearLabel(yearId: number): string {
    return this.academicYears().find((y) => y.id === yearId)?.name ?? '—';
  }

  getClassSectionLabel(): string {
    const id = this.filterClassSectionId();
    if (!id) return '';
    const cs = this.classSections().find((s) => s.id === id);
    return cs ? `${cs.className} - ${cs.sectionName}` : '';
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }
}
