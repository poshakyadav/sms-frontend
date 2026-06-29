// variable-form.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TemplateDefinition } from '../../../types/whatsapp.types';

export interface VariableFormValue {
  recipientPhone: string;
  recipientName: string;
  variables: Record<string, string>;
}

// Human-readable labels for well-known variable names
const VARIABLE_LABELS: Record<string, string> = {
  parent_name: 'Parent name',
  school_name: 'School name',
  school_name_2: 'School name (footer)',
  school_name_3: 'School name (team)',
  school_name_footer: 'School name (footer)',
  school_name_team: 'School name (team)',
  student_name: 'Student name',
  student_name_2: 'Student name (repeat)',
  class_section: 'Class & section',
  roll_number: 'Roll number',
  month: 'Month (e.g. June 2026)',
  fee_breakdown: 'Fee breakdown',
  total_due: 'Total due (₹)',
  due_date: 'Due date',
  contact: 'Contact number',
  receipt_number: 'Receipt number',
  payment_date: 'Payment date',
  payment_mode: 'Payment mode',
  academic_year: 'Academic year',
  fees_paid_breakdown: 'Fees paid breakdown',
  amount_paid: 'Amount paid (₹)',
  total_annual_fee: 'Total annual fee (₹)',
  total_paid_ytd: 'Total paid YTD (₹)',
  concession_given: 'Concession given (₹)',
  balance_remaining: 'Balance remaining (₹)',
  school_name_team2: 'School name (accounts team)',
  overdue_breakdown: 'Overdue breakdown',
  amount_overdue: 'Amount overdue (₹)',
  was_due_on: 'Was due on',
  days_overdue: 'Days overdue',
  fee_type: 'Fee type',
  fee_description: 'Fee description',
  amount: 'Amount',
  applicable_period: 'Applicable period',
  is_mandatory: 'Mandatory (Yes/No)',
  exam_name: 'Exam name',
  exam_name_2: 'Exam name (repeat)',
  exam_type: 'Exam type',
  subject_schedule: 'Subject schedule',
  exam_start_date: 'Exam start date',
  exam_end_date: 'Exam end date',
  report_time: 'Report time',
  first_exam_date: 'First exam date',
  first_exam_time: 'First exam time',
  venue: 'Venue',
  portal_url: 'Portal URL',
  result_summary: 'Result summary',
  total_marks: 'Total marks obtained',
  total_out_of: 'Total marks out of',
  percentage: 'Percentage (%)',
  overall_grade: 'Overall grade',
  result_status: 'Result status (PASS/FAIL)',
  date: 'Date',
  status: 'Attendance status',
  note: 'Note',
  working_days: 'Working days',
  present_days: 'Present days',
  absent_days: 'Absent days',
  leave_days: 'Leave/holiday days',
  attendance_pct: 'Attendance %',
  required_pct: 'Required %',
  shortfall_pct: 'Shortfall %',
  school_name_2_footer: 'School name (footer)',
  admission_number: 'Admission number',
  admission_date: 'Admission date',
  parent_name2: 'Parent name',
  subject: 'Subject',
  teacher_name: 'Teacher name',
  assignment_title: 'Assignment title',
  assignment_type: 'Assignment type',
  max_marks: 'Max marks',
  description: 'Description',
  recipient_name: 'Recipient name',
  regarding: 'Regarding',
  notice_details: 'Notice details',
  closed_on: 'Closed on',
  reason: 'Reason',
  classes_resume: 'Classes resume',
  optional_message: 'Optional message',
  ptm_date: 'PTM date',
  time_slot: 'Time slot',
};

// Variables that should use a textarea instead of single-line input
const MULTILINE_VARS = new Set([
  'fee_breakdown',
  'fees_paid_breakdown',
  'overdue_breakdown',
  'subject_schedule',
  'result_summary',
  'notice_details',
  'description',
  'fee_description',
  'optional_message',
]);

@Component({
  selector: 'app-variable-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './variable-form.html',
  styleUrls: ['./variable-form.scss'],
})
export class VariableForm implements OnChanges {
  @Input() template: TemplateDefinition | null = null;
  @Output() formChange = new EventEmitter<VariableFormValue | null>();
  @Output() formValidChange = new EventEmitter<boolean>();

  private fb = inject(FormBuilder);

  recipientForm!: FormGroup;
  variablesForm!: FormGroup;

  // Deduplicated variables for display (skip _2, _3 repeats in UI)
  displayVariables: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template']) {
      this.buildForms();
    }
  }

  private buildForms(): void {
    if (!this.template) return;

    // Recipient fields
    this.recipientForm = this.fb.group({
      recipientPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-]{7,15}$/)]],
      recipientName: ['', [Validators.required, Validators.minLength(2)]],
    });

    // Build variables form — one control per unique variable name
    const vars = this.template.variables;
    const controls: Record<string, any> = {};

    // Compute which vars need to be shown — skip _2, _3 duplicates
    const seen = new Set<string>();
    this.displayVariables = [];

    vars.forEach((varName) => {
      // Strip _2, _3 suffix to find base name
      const baseName = varName.replace(/_[23]$/, '');
      const isRepeat = varName !== baseName && seen.has(baseName);

      if (!isRepeat) {
        seen.add(baseName);
        this.displayVariables.push(varName);
      }
      // Always create the control
      controls[varName] = ['', Validators.required];
    });

    this.variablesForm = this.fb.group(controls);

    // When any form changes, emit the combined value
    const emitChange = () => {
      const allValid = this.recipientForm.valid && this.variablesForm.valid;
      this.formValidChange.emit(allValid);
      if (allValid) {
        this.formChange.emit(this.buildValue());
      } else {
        this.formChange.emit(null);
      }
    };

    this.recipientForm.valueChanges.subscribe(emitChange);
    this.variablesForm.valueChanges.subscribe(() => {
      // Auto-fill repeated variables from their base
      this.autoFillRepeats();
      emitChange();
    });
  }

  private autoFillRepeats(): void {
    if (!this.template) return;
    const vars = this.template.variables;
    vars.forEach((varName) => {
      const baseName = varName.replace(/_[23]$/, '');
      if (varName !== baseName) {
        const baseValue = this.variablesForm.get(baseName)?.value;
        const control = this.variablesForm.get(varName);
        if (control && baseValue !== undefined && control.value !== baseValue) {
          control.setValue(baseValue, { emitEvent: false });
        }
      }
    });
  }

  private buildValue(): VariableFormValue {
    return {
      recipientPhone: this.recipientForm.value.recipientPhone,
      recipientName: this.recipientForm.value.recipientName,
      variables: this.variablesForm.value,
    };
  }

  getLabelFor(varName: string): string {
    return VARIABLE_LABELS[varName] ?? varName.replace(/_/g, ' ');
  }

  isMultiline(varName: string): boolean {
    return MULTILINE_VARS.has(varName);
  }

  isRepeatVar(varName: string): boolean {
    const base = varName.replace(/_[23]$/, '');
    return varName !== base;
  }

  getPlaceholder(varName: string): string {
    const examples: Record<string, string> = {
      parent_name: 'e.g. Mr. Rahul Sharma',
      school_name: 'e.g. Delhi Public School',
      student_name: 'e.g. Rohan Sharma',
      class_section: 'e.g. Class 9 - A',
      roll_number: 'e.g. 42',
      month: 'e.g. June 2026',
      fee_breakdown: 'e.g. Tuition Fee: ₹3500 | Library Fee: ₹200',
      total_due: 'e.g. 4000',
      due_date: 'e.g. 10 Jun 2026',
      contact: 'e.g. 9876543210',
      academic_year: 'e.g. 2025-2026',
    };
    return examples[varName] ?? '';
  }

  hasError(formGroup: FormGroup, controlName: string): boolean {
    const ctrl = formGroup.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  markAllTouched(): void {
    this.recipientForm.markAllAsTouched();
    this.variablesForm.markAllAsTouched();
  }

  // Expose live values for preview (even if form is incomplete)
  get previewValues(): Record<string, string> {
    return this.variablesForm?.value ?? {};
  }
}