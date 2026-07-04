import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import {
  ALL_ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_CONFIG,
  AttendanceBatchInput,
  AttendanceService,
  AttendanceStatus,
  AttendanceStatusValue,
  ClassAttendanceSessionMeta,
  HalfDaySession,
  HalfDaySessionValue,
} from '../../../../core/services/attendance.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

// Flattens ClassAttendanceStudentRow.attendanceRecord into editable fields.
// Unmarked students (attendanceRecord === null) default to PRESENT, per the
// backend's documented frontend contract — lets a teacher submit an
// "everyone present" sheet in one click.
interface AttendanceRow {
  enrollmentId: number;
  studentId: number;
  name: string;
  rollNumber: string;
  avatarUrl: string | null;
  status: AttendanceStatusValue;
  halfDaySession: HalfDaySessionValue | null;
  notes: string;
  isMarked: boolean;
  markedByName?: string;
}

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
    MatButtonToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
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

  readonly statusConfig = ATTENDANCE_STATUS_CONFIG;
  readonly allStatuses = ALL_ATTENDANCE_STATUSES;
  readonly halfDaySessionOptions = [
    { value: HalfDaySession.MORNING, label: 'Morning' },
    { value: HalfDaySession.AFTERNOON, label: 'Afternoon' },
  ];

  classSections = signal<ClassSection[]>([]);
  rows = signal<AttendanceRow[]>([]);
  originalRows = signal<AttendanceRow[]>([]);
  sessionMeta = signal<ClassAttendanceSessionMeta | null>(null);
  searchTerm = signal('');

  loading = signal(true);
  submitting = signal(false);

  form = inject(FormBuilder).group({
    classSectionId: [null as number | null, Validators.required],
    date: [new Date(), Validators.required],
  });

  filteredRows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(
      (r) => r.name.toLowerCase().includes(term) || r.rollNumber.toLowerCase().includes(term)
    );
  });

  isValid = computed(() =>
    this.rows().every(
      (r) => !!r.status && (r.status !== AttendanceStatus.HALF_DAY || !!r.halfDaySession)
    )
  );

  hasChanges = computed(() => {
    const curr = this.rows();
    const orig = this.originalRows();
    return curr.some((r, i) => {
      const o = orig[i];
      return !o || r.status !== o.status || r.halfDaySession !== o.halfDaySession || r.notes !== o.notes;
    });
  });

  dateDisplay = computed(() => {
    const d = this.form.value.date;
    return d ? this.datePipe.transform(d, 'EEEE, MMMM d, yyyy') : '';
  });

  selectedSection = computed(() => {
    const id = this.form.value.classSectionId;
    return this.classSections().find((cs) => cs.id === id) ?? null;
  });

  presentCount = computed(
    () => this.rows().filter((r) => this.statusConfig[r.status].category === 'present').length
  );
  absentCount = computed(
    () => this.rows().filter((r) => this.statusConfig[r.status].category === 'absent').length
  );
  neutralCount = computed(
    () => this.rows().filter((r) => this.statusConfig[r.status].category === 'neutral').length
  );

  // Exact-status breakdown, only for statuses in use — feeds the small chip
  // row under the 3 category cards (e.g. "3 Late · 1 Sick · 1 On Duty").
  statusBreakdown = computed(() => {
    const counts = new Map<AttendanceStatusValue, number>();
    for (const r of this.rows()) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return this.allStatuses
      .filter((s) => (counts.get(s) ?? 0) > 0)
      .map((s) => ({ status: s, count: counts.get(s)!, config: this.statusConfig[s] }));
  });

  lastUpdatedDisplay = computed(() => {
    const meta = this.sessionMeta();
    return meta?.lastUpdatedAt ? this.datePipe.transform(meta.lastUpdatedAt, 'h:mm a') : null;
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

    this.attendance.getByClassSection(classSectionId, formattedDate).subscribe({
      next: (res) => {
        const mapped: AttendanceRow[] = res.students.map((s) => ({
          enrollmentId: s.enrollmentId,
          studentId: s.studentId,
          name: s.studentName,
          rollNumber: s.rollNumber ?? '',
          avatarUrl: s.avatarUrl,
          status: s.attendanceRecord?.status ?? AttendanceStatus.PRESENT,
          halfDaySession: s.attendanceRecord?.halfDaySession ?? null,
          notes: s.attendanceRecord?.notes ?? '',
          isMarked: s.attendanceRecord != null,
          markedByName: s.attendanceRecord?.markedByName,
        }));
        this.rows.set(mapped);
        this.originalRows.set(structuredClone(mapped));
        this.sessionMeta.set(res.session);
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to load students'),
      complete: () => this.loading.set(false),
    });
  }

  setStatus(enrollmentId: number, status: AttendanceStatusValue) {
    this.rows.update((list) =>
      list.map((r) =>
        r.enrollmentId === enrollmentId
          ? {
            ...r,
            status,
            halfDaySession:
              status === AttendanceStatus.HALF_DAY
                ? r.halfDaySession ?? HalfDaySession.MORNING
                : null,
          }
          : r
      )
    );
  }

  setHalfDaySession(enrollmentId: number, session: HalfDaySessionValue) {
    this.rows.update((list) =>
      list.map((r) => (r.enrollmentId === enrollmentId ? { ...r, halfDaySession: session } : r))
    );
  }

  updateNotes(enrollmentId: number, notes: string) {
    this.rows.update((list) =>
      list.map((r) => (r.enrollmentId === enrollmentId ? { ...r, notes } : r))
    );
  }

  // Bulk actions apply to the currently filtered/searched set — a teacher
  // can search "Sharma" and set just those students to EXCUSED.
  setAll(status: AttendanceStatusValue) {
    const label = this.statusConfig[status].label;
    const targets = this.filteredRows();
    const msg = `Set ${targets.length} student${targets.length === 1 ? '' : 's'} to ${label}?`;

    this.dialog
      .open(ConfirmDialog, { data: msg })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const targetIds = new Set(targets.map((r) => r.enrollmentId));
        this.rows.update((list) =>
          list.map((r) =>
            targetIds.has(r.enrollmentId)
              ? {
                ...r,
                status,
                halfDaySession:
                  status === AttendanceStatus.HALF_DAY ? HalfDaySession.MORNING : null,
              }
              : r
          )
        );
        this.toast.success(`Set to ${label}`);
      });
  }

  resetChanges() {
    this.dialog
      .open(ConfirmDialog, { data: 'Discard all unsaved changes?' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.rows.set(structuredClone(this.originalRows()));
          this.toast.info('Changes discarded');
        }
      });
  }

  submit() {
    if (!this.form.valid || !this.isValid()) {
      this.toast.warning('Please select a class-section, date, and ensure every student has a status');
      return;
    }

    const { classSectionId, date } = this.form.value;
    const formattedDate = this.datePipe.transform(date, 'yyyy-MM-dd')!;

    const batch: AttendanceBatchInput = {
      date: formattedDate,
      classSectionId: classSectionId!,
      attendances: this.rows().map((r) => ({
        studentId: r.studentId,
        status: r.status,
        ...(r.status === AttendanceStatus.HALF_DAY ? { halfDaySession: r.halfDaySession! } : {}),
        ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
      })),
    };

    this.submitting.set(true);
    this.attendance.markAttendanceBatch(batch).subscribe({
      next: (res) => {
        this.toast.success(res.message || 'Attendance saved successfully');
        this.loadStudents();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to save attendance'),
      complete: () => this.submitting.set(false),
    });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');
  }

  statusClass(status: AttendanceStatusValue): string {
    return 'status-' + status.toLowerCase().replace(/_/g, '-');
  }
}