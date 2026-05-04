import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { AcademicsService } from '../../../../../core/services/academics.service';
import { FeesService } from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { INDIAN_DATE_PROVIDERS } from '../../../../../core/adapters/indian-date-adapter';

@Component({
  selector: 'app-fee-structure-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  // ── Provide the Indian DD/MM/YYYY date adapter for this form ────────────────
  // DatePipe is also provided here so we can format the Date → 'yyyy-MM-dd'
  // before sending to the backend (which expects ISO date strings).
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
  templateUrl: './fee-structure-form.html',
  styleUrl: './fee-structure-form.scss',
})
export class FeeStructureForm implements OnInit {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private feesService = inject(FeesService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);
  // DatePipe is used to convert the Date object from the datepicker to
  // a 'yyyy-MM-dd' string that the Zod schema on the backend accepts.
  private datePipe = inject(DatePipe);

  isEdit = signal(false);
  structureId = signal<number | null>(null);
  pageLoading = signal(false);
  submitting = signal(false);

  academicYears = signal<any[]>([]);
  classSections = signal<any[]>([]);

  /**
   * Common fee-type suggestions shown as quick-fill chips below the input.
   * The school owner can still type anything — these are shortcuts only.
   */
  feeTypeSuggestions: string[] = [
    'Tuition',
    'Transport',
    'Library',
    'Exam',
    'Admission',
    'Sports',
    'Lab',
    'Hostel',
    'Canteen',
    'Uniform',
  ];

  form = this.fb.group({
    academicYearId: [null as number | null, Validators.required],
    classSectionId: [null as number | null, Validators.required],
    feeType: ['', [Validators.required, Validators.minLength(3)]],
    // amount is stored as a number; the input type="number" handles the cast
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    // dueDate holds a Date object (from the Material datepicker) while in the
    // form. It is converted to 'yyyy-MM-dd' only when building the payload.
    dueDate: [null as Date | null],
    isMandatory: [true],
    description: [''],
  });

  ngOnInit() {
    this.loadOptions();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && !isNaN(+id)) {
      this.isEdit.set(true);
      this.structureId.set(+id);
      this.loadStructure(+id);
    }
  }

  /** Fills the feeType control when the user clicks a suggestion chip. */
  setFeeType(value: string): void {
    this.form.get('feeType')?.setValue(value);
    this.form.get('feeType')?.markAsTouched();
  }

  private loadOptions() {
    this.academicsService.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years ?? []),
    });
    this.academicsService.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections ?? []),
    });
  }

  private loadStructure(id: number) {
    this.pageLoading.set(true);

    this.feesService.getFeeStructures().subscribe({
      next: (res) => {
        const s = res.structures.find((x: any) => x.id === id);
        if (s) {
          // dueDate from backend is 'yyyy-MM-dd' string (or null).
          // The IndianDateAdapter.parse() handles ISO strings via its fallback
          // branch, so patchValue with the raw string works correctly.
          this.form.patchValue({
            academicYearId: s.academicYearId,
            classSectionId: s.classSectionId,
            feeType: s.feeType,
            amount: s.amount,
            // Pass the ISO string directly; the adapter converts it to a Date
            dueDate: s.dueDate ? new Date(s.dueDate) : null,
            isMandatory: s.isMandatory,
            description: s.description ?? '',
          });
        }
        this.pageLoading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load fee structure');
        this.router.navigate(['/school/fees/structures']);
      },
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill in all required fields');
      return;
    }

    this.submitting.set(true);

    const raw = this.form.getRawValue();

    // ── Date serialisation ────────────────────────────────────────────────────
    // The datepicker stores a JS Date object in the control.
    // The backend Zod schema uses z.string().date() which expects 'yyyy-MM-dd'.
    // DatePipe.transform() converts the Date correctly regardless of timezone.
    const dueDateStr = raw.dueDate
      ? this.datePipe.transform(raw.dueDate, 'yyyy-MM-dd') ?? undefined
      : undefined;

    const payload = {
      academicYearId: raw.academicYearId!,
      classSectionId: raw.classSectionId!,
      feeType: raw.feeType!.trim(),
      // Ensure we send a number, not a string from the input
      amount: Number(raw.amount!),
      dueDate: dueDateStr,
      isMandatory: raw.isMandatory!,
      description: raw.description?.trim() || undefined,
    };

    const obs$ = this.isEdit()
      ? this.feesService.updateFeeStructure(this.structureId()!, payload)
      : this.feesService.createFeeStructure(payload);

    obs$.subscribe({
      next: () => {
        this.toast.success(
          this.isEdit()
            ? 'Fee structure updated successfully'
            : 'Fee structure created successfully'
        );
        this.router.navigate(['/school/fees/structures']);
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to save fee structure');
        this.submitting.set(false);
      },
    });
  }
}
