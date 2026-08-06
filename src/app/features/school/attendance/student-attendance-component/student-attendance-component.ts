// student-attendance-component.ts  (staff view — features/school/attendance/student-attendance-component/)
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { AcademicsService } from '../../../../core/services/academics.service';
import {
  AttendanceService,
  ReconstructedAttendanceRecord,
  getReconstructedStatusDisplay,
} from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-student-attendance-component',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatTooltipModule,
  ],
  providers: [DatePipe],
  templateUrl: './student-attendance-component.html',
  styleUrl: './student-attendance-component.scss',
})
export class StudentAttendanceComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private attendance = inject(AttendanceService);
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private datePipe = inject(DatePipe);

  readonly getReconstructedStatusDisplay = getReconstructedStatusDisplay;

  studentId = signal<number>(0);
  studentName = signal<string>('Student');
  records = signal<ReconstructedAttendanceRecord[]>([]);

  loading = signal(true);
  error = signal<string | null>(null);

  displayedColumns = ['date', 'status', 'notes'];

  // Newest first for the table — the backend returns records sorted ascending.
  sortedRecords = computed(() =>
    [...this.records()].sort((a, b) => b.date.localeCompare(a.date))
  );

  // Holidays and genuinely-unmarked days are excluded from every attendance
  // stat below — a holiday isn't an attendance outcome, and an unmarked day
  // is "unknown," not "absent." Counting either would silently distort the
  // percentage exactly the way the old implicit-present bug used to.
  relevantRecords = computed(() =>
    this.records().filter((r) => r.status !== 'HOLIDAY' && r.status !== 'UNMARKED')
  );

  totalDays = computed(() => this.relevantRecords().length);
  presentDays = computed(() => this.relevantRecords().filter((r) => r.status === 'PRESENT').length);
  absentDays = computed(() => this.relevantRecords().filter((r) => r.status === 'ABSENT').length);
  lateDays = computed(
    () => this.relevantRecords().filter((r) => r.status === 'LATE' || r.status === 'HALF_DAY').length
  );
  unmarkedDays = computed(() => this.records().filter((r) => r.status === 'UNMARKED').length);
  holidayDays = computed(() => this.records().filter((r) => r.status === 'HOLIDAY').length);

  presentPercentage = computed(() => {
    // Same denominator rule the backend uses: EXCUSED / ON_DUTY days don't
    // count for or against the student, so they're dropped from both sides.
    const denom = this.relevantRecords().filter(
      (r) => r.status !== 'EXCUSED' && r.status !== 'ON_DUTY'
    );
    if (denom.length === 0) return 0;
    const effective =
      denom.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length +
      denom.filter((r) => r.status === 'HALF_DAY').length * 0.5;
    return Math.round((effective / denom.length) * 100);
  });

  attendanceColor = computed(() => {
    const p = this.presentPercentage();
    if (p >= 75) return 'primary';
    if (p >= 60) return 'accent';
    return 'warn';
  });

  dateForm = this.fb.group({
    fromDate: [new Date(new Date().getFullYear(), new Date().getMonth(), 1)],
    toDate: [new Date()],
  });

  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.studentId.set(+this.route.snapshot.paramMap.get('studentId')!);
    if (!this.studentId()) {
      this.error.set('Invalid student ID');
      this.loading.set(false);
      return;
    }

    this.loadStudentName();
    this.loadAttendance();

    this.dateForm.valueChanges
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.loadAttendance());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStudentName() {
    this.academics.getEnrollments().subscribe((res) => {
      const enr = res.enrollments.find((e) => e.studentId === this.studentId());
      if (enr) this.studentName.set(enr.studentName || 'Student');
    });
  }

  private loadAttendance() {
    const { fromDate, toDate } = this.dateForm.value;
    if (!fromDate || !toDate) return;

    const from = this.datePipe.transform(fromDate, 'yyyy-MM-dd')!;
    const to = this.datePipe.transform(toDate, 'yyyy-MM-dd')!;

    this.loading.set(true);
    this.attendance.getByStudent(this.studentId(), from, to).subscribe({
      next: (res) => this.records.set(res.attendance),
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load attendance');
        this.toast.error('Failed to load attendance');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  back() {
    this.router.navigate(['/school/attendance/mark']);
  }

  statusClass(status: string): string {
    return status; // matches attendance-shared .status-chip.<STATUS> selectors
  }
}