// edit-mapping-dialog.ts
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import {
  AcademicsService,
  AcademicYear,
  ClassSection,
  ClassSectionMapping,
} from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';

export interface EditMappingDialogData {
  mapping: ClassSectionMapping;
  academicYears: AcademicYear[];
}

@Component({
  selector: 'app-edit-mapping-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatRadioModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './edit-mapping-dialog.html',
  styleUrl: 'edit-mapping-dialog.scss',
})
export class EditMappingDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<EditMappingDialogComponent>);
  data: EditMappingDialogData = inject(MAT_DIALOG_DATA);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  classSections = signal<ClassSection[]>([]);
  saving = signal(false);
  scopeType = signal<'global' | 'year'>(this.data.mapping.isGlobal ? 'global' : 'year');

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      currentClassSectionId: [this.data.mapping.currentClassSectionId, Validators.required],
      nextClassSectionId: [this.data.mapping.nextClassSectionId, Validators.required],
      academicYearId: [this.data.mapping.academicYearId ?? null],
    });

    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections ?? []),
      error: () => this.toast.error('Failed to load class-sections'),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.scopeType() === 'year' && !this.form.value.academicYearId) {
      this.toast.warning('Please select an academic year');
      return;
    }

    this.saving.set(true);

    const payload = {
      currentClassSectionId: this.form.value.currentClassSectionId,
      nextClassSectionId: this.form.value.nextClassSectionId,
      academicYearId: this.scopeType() === 'global' ? null : this.form.value.academicYearId,
    };

    this.academics.updateMapping(this.data.mapping.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close({ success: true });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to update mapping');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
