import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import {
  AttendanceBatchInput,
  AttendanceService,
  EnrolledStudentForAttendance,
} from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-attendance-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  providers: [DatePipe],
  templateUrl: './attendance-component.html',
  styleUrl: './attendance-component.scss',
})
export class AttendanceComponent {
  private attendance = inject(AttendanceService);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private datePipe = inject(DatePipe);

  classSections = signal<ClassSection[]>([]);
  students = signal<EnrolledStudentForAttendance[]>([]);
  originalStudents = signal<EnrolledStudentForAttendance[]>([]);

  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).group({
    classSectionId: [null as number | null, Validators.required],
    date: [new Date(), Validators.required],
  });

  displayedColumns = ['rollNumber', 'name', 'status', 'notes'];

  statusOptions = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'] as const;
  statusLabels: Record<string, string> = {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    LATE: 'Late',
    HALF_DAY: 'Half Day',
  };

  isValid = computed(() => this.students().every((s) => !!s.status));
  hasChanges = computed(() => {
    const curr = this.students();
    const orig = this.originalStudents();
    return curr.some((s, i) => s.status !== orig[i]?.status || s.notes !== orig[i]?.notes);
  });

  dateDisplay = computed(() => {
    const d = this.form.value.date;
    return d ? this.datePipe.transform(d, 'EEEE, MMMM d, yyyy') : '';
  });

  presentCount = computed(() => this.students().filter((s) => s.status === 'PRESENT').length);
  absentCount = computed(() => this.students().filter((s) => s.status === 'ABSENT').length);
  lateCount = computed(() => this.students().filter((s) => s.status === 'LATE').length);

  selectedSection = computed(() => {
    const id = this.form.value.classSectionId;
    return this.classSections().find((cs) => cs.id === id) ?? null;
  });

  constructor() {
    this.loadClassSections();
    this.form.valueChanges.subscribe(() => {
      if (this.form.valid) this.loadStudents();
    });
  }

  private loadClassSections() {
    this.academics.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
      complete: () => this.loading.set(false),
    });
  }

  loadStudents() {
    const { classSectionId, date } = this.form.value;
    if (!classSectionId || !date) return;

    this.loading.set(true);
    const formattedDate = this.datePipe.transform(date, 'yyyy-MM-dd')!;

    this.attendance.getEnrolledStudentsForMarking(classSectionId, formattedDate).subscribe({
      next: (students) => {
        this.students.set(students);
        this.originalStudents.set(structuredClone(students));
      },
      error: (err) => this.toast.error(err.message),
      complete: () => this.loading.set(false),
    });
  }

  updateStatus(id: number, status: (typeof this.statusOptions)[number]) {
    this.students.update((list) => list.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  updateNotes(id: number, notes: string) {
    this.students.update((list) =>
      list.map((s) => (s.id === id ? { ...s, notes: notes || undefined } : s))
    );
  }

  setAll(status: (typeof this.statusOptions)[number]) {
    const msg = `Set all ${this.students().length} students to ${this.statusLabels[status]}?`;
    this.dialog
      .open(ConfirmDialog, { data: msg })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.students.update((list) => list.map((s) => ({ ...s, status })));
          this.toast.success(`All set to ${this.statusLabels[status]}`);
        }
      });
  }

  resetChanges() {
    this.dialog
      .open(ConfirmDialog, { data: 'Discard all unsaved changes?' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.students.set(structuredClone(this.originalStudents()));
          this.toast.info('Changes discarded');
        }
      });
  }

  submit() {
    if (!this.form.valid || !this.isValid()) {
      this.toast.warning('Please select class-section, date, and mark all statuses');
      return;
    }

    const { classSectionId, date } = this.form.value;
    const formattedDate = this.datePipe.transform(date, 'yyyy-MM-dd')!;

    const batch: AttendanceBatchInput = {
      date: formattedDate,
      classSectionId: classSectionId!,
      attendances: this.students().map((s) => ({
        studentId: s.id,
        status: s.status!,
        notes: s.notes,
      })),
    };

    this.submitting.set(true);
    this.attendance.markAttendanceBatch(batch).subscribe({
      next: () => {
        this.toast.success('Attendance saved successfully');
        this.loadStudents();
      },
      error: (err) => this.toast.error(err.message || 'Failed to save'),
      complete: () => this.submitting.set(false),
    });
  }
}
