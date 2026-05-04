// mappings-bulk.ts
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { AcademicsService, AcademicYear } from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';

type ScopeMode = 'global' | 'year';

@Component({
  selector: 'app-mappings-bulk',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatRadioModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './mappings-bulk.html',
  styleUrl: './mappings-bulk.scss',
})
export class MappingsBulk implements OnInit {
  private fb = inject(FormBuilder);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  readonly router = inject(Router);

  form: FormGroup;
  classSections = signal<any[]>([]);
  academicYears = signal<AcademicYear[]>([]);
  loadingData = signal(true);
  submitting = signal(false);

  /** Global = academicYearId null; Year = specific year for ALL rows */
  scopeMode = signal<ScopeMode>('global');
  selectedYearId = signal<number | null>(null);

  constructor() {
    this.form = this.fb.group({ mappings: this.fb.array([]) });
    this.addRow();
  }

  ngOnInit(): void {
    this.loadData();
  }

  get mappingsArray(): FormArray {
    return this.form.get('mappings') as FormArray;
  }

  get rows(): FormGroup[] {
    return this.mappingsArray.controls as FormGroup[];
  }

  addRow(): void {
    this.mappingsArray.push(
      this.fb.group({
        currentClassSectionId: [null, Validators.required],
        nextClassSectionId: [null, Validators.required],
      })
    );
  }

  removeRow(index: number): void {
    if (this.mappingsArray.length > 1) {
      this.mappingsArray.removeAt(index);
    } else {
      this.toast.warning('At least one mapping row is required');
    }
  }

  private loadData(): void {
    let loaded = 0;
    const done = () => {
      if (++loaded === 2) this.loadingData.set(false);
    };

    this.academics.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections ?? []);
        done();
      },
      error: () => {
        this.toast.error('Failed to load class-sections');
        done();
      },
    });

    this.academics.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears.set(res.years ?? []);
        // Default selected year to current
        const current = res.years?.find((y) => y.isCurrent);
        if (current) this.selectedYearId.set(current.id);
        done();
      },
      error: () => {
        done();
      },
    });
  }

  label(cs: any): string {
    return `${cs.className} — ${cs.sectionName}`;
  }

  currentYearName = () => {
    const y = this.academicYears().find((yr) => yr.id === this.selectedYearId());
    return y?.name ?? '';
  };

  isDuplicateSource(index: number): boolean {
    const currentId = this.rows[index]?.get('currentClassSectionId')?.value;
    if (!currentId) return false;
    return this.rows.some(
      (row, i) => i !== index && row.get('currentClassSectionId')?.value === currentId
    );
  }

  isSelfMapping(row: FormGroup): boolean {
    const cur = row.get('currentClassSectionId')?.value;
    const nxt = row.get('nextClassSectionId')?.value;
    return cur !== null && cur === nxt;
  }

  formHasErrors(): boolean {
    if (this.form.invalid) return true;
    if (this.scopeMode() === 'year' && !this.selectedYearId()) return true;
    if (this.rows.some((r, i) => this.isDuplicateSource(i))) return true;
    if (this.rows.some((r) => this.isSelfMapping(r))) return true;
    return false;
  }

  save(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.toast.warning('Please fill in all required fields');
      return;
    }
    if (this.scopeMode() === 'year' && !this.selectedYearId()) {
      this.toast.warning('Please select an academic year');
      return;
    }
    if (this.rows.some((r, i) => this.isDuplicateSource(i))) {
      this.toast.warning(
        'Duplicate source class-sections detected. Each source can only appear once.'
      );
      return;
    }
    if (this.rows.some((r) => this.isSelfMapping(r))) {
      this.toast.warning('A class-section cannot map to itself');
      return;
    }

    this.submitting.set(true);

    const academicYearId = this.scopeMode() === 'global' ? null : this.selectedYearId();

    const payload = this.mappingsArray.value.map((row: any) => ({
      currentClassSectionId: row.currentClassSectionId,
      nextClassSectionId: row.nextClassSectionId,
      academicYearId,
    }));

    this.academics.createBulkMappings(payload).subscribe({
      next: (res) => {
        const msg = res.message ?? `${res.created} mapping(s) created`;
        this.toast.success(msg);
        if (res.errors?.length > 0) {
          this.toast.warning(`${res.skipped} row(s) skipped: ${res.errors[0]}`);
        }
        this.router.navigate(['/school/academics/mappings']);
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to create mappings');
        this.submitting.set(false);
      },
    });
  }
}
