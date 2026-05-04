import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { Router, RouterModule } from '@angular/router';
import {
  AcademicsService,
  AcademicYear,
  ClassSectionMapping,
} from '../../../../../core/services/academics.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { EditMappingDialogComponent } from '../edit-mapping-dialog/edit-mapping-dialog';

export type ScopeOption = 'all' | 'global' | number;

@Component({
  selector: 'app-mappings-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
  ],
  templateUrl: './mappings-list.html',
  styleUrl: './mappings-list.scss',
})
export class MappingsList implements OnInit {
  private academics = inject(AcademicsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  displayedColumns = ['currentDisplayName', 'arrow', 'nextDisplayName', 'scope', 'actions'];

  mappings = signal<ClassSectionMapping[]>([]);
  academicYears = signal<AcademicYear[]>([]);
  loading = signal(true);
  loadingYears = signal(true);
  error = signal<string | null>(null);

  /** 'all' | 'global' | yearId (number) */
  selectedScope = signal<ScopeOption>('all');

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canManage = computed(() => this.auth.hasPermission('academics.mappings.manage'));

  // ── Scope label for display ────────────────────────────────────────────────
  scopeLabel = computed(() => {
    const s = this.selectedScope();
    if (s === 'all') return 'All Mappings';
    if (s === 'global') return 'Global Mappings';
    const year = this.academicYears().find((y) => y.id === s);
    return year ? `Year: ${year.name}` : 'Selected Year';
  });

  currentYear = computed(() => this.academicYears().find((y) => y.isCurrent));

  ngOnInit(): void {
    this.loadAcademicYears();
    this.loadMappings();
  }

  loadAcademicYears(): void {
    this.loadingYears.set(true);
    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years ?? []);
        this.loadingYears.set(false);
      },
      error: () => {
        this.loadingYears.set(false);
      },
    });
  }

  loadMappings(): void {
    this.loading.set(true);
    this.error.set(null);

    this.academics.getClassSectionMappings(this.selectedScope()).subscribe({
      next: (res) => {
        this.mappings.set(res.mappings ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load mappings');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  onScopeChange(scope: ScopeOption): void {
    this.selectedScope.set(scope);
    this.loadMappings();
  }

  edit(mapping: ClassSectionMapping): void {
    const classSections = this.getClassSections();
    const ref = this.dialog.open(EditMappingDialogComponent, {
      width: '520px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        mapping,
        academicYears: this.academicYears(),
        classSections,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.toast.success('Mapping updated successfully');
        this.loadMappings();
      }
    });
  }

  private getClassSections(): any[] {
    // Class sections are loaded by the edit dialog itself via AcademicsService
    return [];
  }

  delete(mapping: ClassSectionMapping): void {
    const scopeLabel = mapping.isGlobal
      ? '(global)'
      : `(${mapping.academicYearName ?? 'year-specific'})`;

    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Delete Mapping?',
        message: `Remove promotion mapping: "${mapping.currentDisplayName}" → "${mapping.nextDisplayName}" ${scopeLabel}?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.academics.deleteMapping(mapping.id).subscribe({
        next: () => {
          this.mappings.update((l) => l.filter((m) => m.id !== mapping.id));
          this.toast.success('Mapping deleted');
        },
        error: (err) => this.toast.error(err?.message ?? 'Failed to delete mapping'),
      });
    });
  }

  globalCount = computed(() => this.mappings().filter((m) => m.isGlobal).length);
  yearSpecificCount = computed(() => this.mappings().filter((m) => !m.isGlobal).length);
}
