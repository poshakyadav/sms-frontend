// enrollment-management.ts 

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AcademicsService,
  ClassSection,
  Enrollment,
} from '../../../../../core/services/academics.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { UnenrollStudentDialog } from '../../unenroll/unenroll-student-dialog/unenroll-student-dialog';
import {
  UnenrollmentDetailDialog,
  UnenrollmentDetailDialogData,
} from '../unenrollment-detail-dialog/unenrollment-detail-dialog';

// ── Interfaces ────────────────────────────────────────────────────────────────

export type EnrollStudentStatus = 'NEW' | 'TEMPORARILY_UNENROLLED';

export interface UnenrolledStudent {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  // Enrollment status — NEW or TEMPORARILY_UNENROLLED
  enrollStudentStatus: EnrollStudentStatus;
  // If TEMPORARILY_UNENROLLED, these come from the last enrollment record
  lastClassName?: string;
  lastSectionName?: string;
  lastRollNumber?: string;
  unenrollmentReason?: string;
  unenrolledAt?: string;
}

export interface UnenrolledHistoryStudent {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  isActive?: boolean;
  // From enrollment history (populated by backend)
  lastClassName?: string;
  lastSectionName?: string;
  lastRollNumber?: string;
  unenrollmentType?: 'TEMPORARY' | 'PERMANENT' | null;
  unenrollmentReason?: string;
  unenrolledAt?: string;
  lastEnrollmentId?: number;
}

const PAGE_SIZE = 10;

@Component({
  selector: 'app-enrollment-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    MatBadgeModule,
  ],
  templateUrl: './enrollment-management.html',
  styleUrl: './enrollment-management.scss',
})
export class EnrollmentManagement implements OnInit {
  private academics = inject(AcademicsService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  // ── Permissions ───────────────────────────────────────────────────────────
  canEnroll = computed(() => this.auth.hasPermission('academics.enroll'));
  canUnenroll = computed(() => this.auth.hasPermission('academics.unenroll'));

  // ── Tab state ─────────────────────────────────────────────────────────────
  activeTabIndex = signal(0);

  // ── ENROLL TAB state ─────────────────────────────────────────────────────
  allUnenrolledStudents = signal<UnenrolledStudent[]>([]);
  availableClassSections = signal<ClassSection[]>([]);
  selectedStudent = signal<UnenrolledStudent | null>(null);
  enrollSearchQuery = signal('');
  enrollStatusFilter = signal<'ALL' | EnrollStudentStatus>('ALL');
  enrollPage = signal(1);
  loadingEnroll = signal(true);
  submittingEnroll = signal(false);
  enrollError = signal<string | null>(null);
  enrollForm: FormGroup;

  // ── UNENROLLED HISTORY TAB state ─────────────────────────────────────────
  unenrolledHistoryStudents = signal<UnenrolledHistoryStudent[]>([]);
  unenrollSearchQuery = signal('');
  unenrollPage = signal(1);
  loadingUnenroll = signal(true);
  unenrollError = signal<string | null>(null);
  reenrollingStudentId = signal<number | null>(null);

  // For re-enroll flow
  reEnrollSelectedStudent = signal<UnenrolledHistoryStudent | null>(null);
  reEnrollForm: FormGroup;
  submittingReEnroll = signal(false);

  // ── Computed: ENROLL TAB ──────────────────────────────────────────────────

  newStudentCount = computed(
    () => this.allUnenrolledStudents().filter((s) => s.enrollStudentStatus === 'NEW').length
  );

  tempUnenrolledCount = computed(
    () =>
      this.allUnenrolledStudents().filter((s) => s.enrollStudentStatus === 'TEMPORARILY_UNENROLLED')
        .length
  );

  filteredUnenrolled = computed(() => {
    const q = this.enrollSearchQuery().toLowerCase().trim();
    const filter = this.enrollStatusFilter();
    let all = this.allUnenrolledStudents();

    // Status filter
    if (filter !== 'ALL') {
      all = all.filter((s) => s.enrollStudentStatus === filter);
    }

    // Search filter
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        (s.gender ?? '').toLowerCase().includes(q) ||
        (s.lastClassName ?? '').toLowerCase().includes(q) ||
        (s.lastSectionName ?? '').toLowerCase().includes(q)
    );
  });

  enrollVisibleStudents = computed(() =>
    this.filteredUnenrolled().slice(0, this.enrollPage() * PAGE_SIZE)
  );
  enrollHasMore = computed(
    () => this.enrollVisibleStudents().length < this.filteredUnenrolled().length
  );
  enrollTotalFiltered = computed(() => this.filteredUnenrolled().length);
  enrollTotalAll = computed(() => this.allUnenrolledStudents().length);

  // ── Computed: UNENROLL HISTORY TAB ───────────────────────────────────────
  filteredUnenrollHistory = computed(() => {
    const q = this.unenrollSearchQuery().toLowerCase().trim();
    const all = this.unenrolledHistoryStudents();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        (s.lastClassName ?? '').toLowerCase().includes(q) ||
        (s.lastSectionName ?? '').toLowerCase().includes(q) ||
        (s.lastRollNumber ?? '').toLowerCase().includes(q) ||
        (s.unenrollmentReason ?? '').toLowerCase().includes(q)
    );
  });

  unenrollHistoryVisible = computed(() =>
    this.filteredUnenrollHistory().slice(0, this.unenrollPage() * PAGE_SIZE)
  );
  unenrollHasMore = computed(
    () => this.unenrollHistoryVisible().length < this.filteredUnenrollHistory().length
  );
  unenrollTotalFiltered = computed(() => this.filteredUnenrollHistory().length);
  unenrollTotalAll = computed(() => this.unenrolledHistoryStudents().length);

  temporaryCount = computed(
    () => this.unenrolledHistoryStudents().filter((s) => s.unenrollmentType === 'TEMPORARY').length
  );
  permanentCount = computed(
    () => this.unenrolledHistoryStudents().filter((s) => s.unenrollmentType === 'PERMANENT').length
  );

  constructor() {
    this.enrollForm = this.fb.group({
      classSectionId: [null, Validators.required],
      rollNumber: ['', Validators.maxLength(10)],
    });
    this.reEnrollForm = this.fb.group({
      classSectionId: [null, Validators.required],
      rollNumber: ['', Validators.maxLength(10)],
    });
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  // ── Data Loading ──────────────────────────────────────────────────────────

  loadAllData(): void {
    this.loadEnrollTabData();
    this.loadUnenrollHistoryData();
  }

  loadEnrollTabData(): void {
    this.loadingEnroll.set(true);
    this.enrollError.set(null);

    forkJoin({
      students: this.academics.getUnenrolledStudents(),
      sections: this.academics.getAvailableClassSections(),
    }).subscribe({
      next: ({ students, sections }) => {
        // Backend returns students with enrollStudentStatus + unenrollment details
        // Map to our typed interface — the backend already includes these fields
        const mapped: UnenrolledStudent[] = (students.students ?? []).map((s: any) => ({
          ...s,
          enrollStudentStatus: (s.enrollStudentStatus as EnrollStudentStatus) ?? 'NEW',
        }));
        this.allUnenrolledStudents.set(mapped);
        this.availableClassSections.set(sections.available ?? []);
        this.loadingEnroll.set(false);
      },
      error: (err) => {
        const code = err?.error?.code;
        const msg = code === 'NO_ACADEMIC_YEAR'
          ? 'No active academic year found. Please go to Academics → Years and create one first.'
          : (err?.error?.error ?? err?.message ?? 'Failed to load enrollment data');
  
        this.enrollError.set(msg);
        this.loadingEnroll.set(false);
      },
    });
  }

  loadUnenrollHistoryData(): void {
    this.loadingUnenroll.set(true);
    this.unenrollError.set(null);

    this.academics.getPermanentlyUnenrolledStudents().subscribe({
      next: (res) => {
        this.unenrolledHistoryStudents.set(res.students ?? []);
        this.loadingUnenroll.set(false);
      },
      error: (err) => {
        const code = err?.error?.code;
        const msg = code === 'NO_ACADEMIC_YEAR'
          ? 'No active academic year found. Please go to Academics → Years and create one first.'
          : (err?.error?.error ?? err?.message ?? 'Failed to load unenrollment history');
  
        this.unenrollError.set(msg);
        this.loadingUnenroll.set(false);
      },
    });
  }

  // ── ENROLL TAB actions ────────────────────────────────────────────────────

  selectStudentForEnroll(student: UnenrolledStudent): void {
    this.selectedStudent.set(student);
    this.enrollForm.reset({ classSectionId: null, rollNumber: '' });
  }

  cancelEnrollSelection(): void {
    this.selectedStudent.set(null);
    this.enrollForm.reset();
  }

  confirmEnroll(): void {
    if (!this.selectedStudent() || this.enrollForm.invalid) {
      this.enrollForm.markAllAsTouched();
      return;
    }

    this.submittingEnroll.set(true);

    const payload = {
      studentId: this.selectedStudent()!.id,
      classSectionId: this.enrollForm.value.classSectionId,
      rollNumber: this.enrollForm.value.rollNumber || undefined,
    };

    this.academics.enrollStudent(payload).subscribe({
      next: (res) => {
        this.toast.success(
          `${this.selectedStudent()!.name} enrolled successfully! Roll No: ${
            res.rollNumber ?? 'Auto-assigned'
          }`
        );
        this.selectedStudent.set(null);
        this.enrollForm.reset();
        this.enrollPage.set(1);
        this.loadEnrollTabData();
        this.loadUnenrollHistoryData();
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Enrollment failed';
        this.toast.error(msg);
        this.submittingEnroll.set(false);
      },
      complete: () => this.submittingEnroll.set(false),
    });
  }

  // ── Detail dialog (Enroll tab — temporary unenrolled) ────────────────────

  openEnrollStudentDetailDialog(student: UnenrolledStudent, event: Event): void {
    event.stopPropagation();
    const dialogData: UnenrollmentDetailDialogData = {
      studentId: student.id,
      studentName: student.name,
      prefetchedData: {
        email: student.email,
        phone: student.phone,
        gender: student.gender,
        bloodGroup: student.bloodGroup,
        admissionDate: student.admissionDate,
        avatarUrl: student.avatarUrl,
        lastClassName: student.lastClassName,
        lastSectionName: student.lastSectionName,
        lastRollNumber: student.lastRollNumber,
        unenrollmentType: 'TEMPORARY',
        unenrollmentReason: student.unenrollmentReason,
        unenrolledAt: student.unenrolledAt,
        isActive: true, // TEMPORARILY_UNENROLLED students are still active
      },
    };

    this.dialog.open(UnenrollmentDetailDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: dialogData,
    });
  }

  // ── UNENROLL HISTORY TAB actions ──────────────────────────────────────────

  openUnenrollDialog(student: UnenrolledHistoryStudent, event: Event): void {
    event.stopPropagation();

    const ref = this.dialog.open(UnenrollStudentDialog, {
      width: '580px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        studentId: student.id,
        studentName: student.name,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.toast.success(result.message);
        this.loadEnrollTabData();
        this.loadUnenrollHistoryData();
      }
    });
  }

  openHistoryDetailDialog(student: UnenrolledHistoryStudent, event: Event): void {
    event.stopPropagation();
    const dialogData: UnenrollmentDetailDialogData = {
      studentId: student.id,
      studentName: student.name,
      prefetchedData: {
        email: student.email,
        phone: student.phone,
        gender: student.gender,
        bloodGroup: student.bloodGroup,
        admissionDate: student.admissionDate,
        avatarUrl: student.avatarUrl,
        lastClassName: student.lastClassName,
        lastSectionName: student.lastSectionName,
        lastRollNumber: student.lastRollNumber,
        unenrollmentType: student.unenrollmentType ?? 'PERMANENT',
        unenrollmentReason: student.unenrollmentReason,
        unenrolledAt: student.unenrolledAt,
        isActive: student.isActive,
      },
    };

    this.dialog.open(UnenrollmentDetailDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: dialogData,
    });
  }

  selectStudentForReEnroll(student: UnenrolledHistoryStudent): void {
    if (!this.canReEnroll(student)) return;
    this.reEnrollSelectedStudent.set(student);
    this.reEnrollForm.reset({ classSectionId: null, rollNumber: '' });
  }

  cancelReEnrollSelection(): void {
    this.reEnrollSelectedStudent.set(null);
    this.reEnrollForm.reset();
  }

  confirmReEnroll(): void {
    if (!this.reEnrollSelectedStudent() || this.reEnrollForm.invalid) {
      this.reEnrollForm.markAllAsTouched();
      return;
    }

    const student = this.reEnrollSelectedStudent()!;
    this.submittingReEnroll.set(true);
    this.reenrollingStudentId.set(student.id);

    const payload = {
      studentId: student.id,
      classSectionId: this.reEnrollForm.value.classSectionId,
      rollNumber: this.reEnrollForm.value.rollNumber || undefined,
    };

    this.academics.enrollStudent(payload).subscribe({
      next: (res) => {
        this.toast.success(
          `${student.name} re-enrolled successfully! Roll No: ${res.rollNumber ?? 'Auto-assigned'}`
        );
        this.reEnrollSelectedStudent.set(null);
        this.reEnrollForm.reset();
        this.reenrollingStudentId.set(null);
        this.unenrollPage.set(1);
        this.loadEnrollTabData();
        this.loadUnenrollHistoryData();
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Re-enrollment failed';
        this.toast.error(msg);
        this.submittingReEnroll.set(false);
        this.reenrollingStudentId.set(null);
      },
      complete: () => this.submittingReEnroll.set(false),
    });
  }

  // ── Helper methods ────────────────────────────────────────────────────────

  canReEnroll(student: UnenrolledHistoryStudent): boolean {
    return student.isActive !== false && student.unenrollmentType !== 'PERMANENT';
  }

  setEnrollStatusFilter(filter: 'ALL' | EnrollStudentStatus): void {
    this.enrollStatusFilter.set(filter);
    this.enrollPage.set(1);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }

  getUnenrollmentLabel(type?: string | null): string {
    switch (type) {
      case 'TEMPORARY':
        return 'Temporary';
      case 'PERMANENT':
        return 'Permanent';
      default:
        return 'Unknown';
    }
  }

  onEnrollSearchChange(q: string): void {
    this.enrollSearchQuery.set(q);
    this.enrollPage.set(1);
  }

  onUnenrollSearchChange(q: string): void {
    this.unenrollSearchQuery.set(q);
    this.unenrollPage.set(1);
  }

  loadMoreEnroll(): void {
    this.enrollPage.update((p) => p + 1);
  }

  loadMoreUnenroll(): void {
    this.unenrollPage.update((p) => p + 1);
  }

  refreshAll(): void {
    this.enrollPage.set(1);
    this.unenrollPage.set(1);
    this.loadAllData();
  }

  get classSectionControl() {
    return this.enrollForm.get('classSectionId');
  }

  get reEnrollClassSectionControl() {
    return this.reEnrollForm.get('classSectionId');
  }

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
    if (index !== 1) {
      this.reEnrollSelectedStudent.set(null);
      this.reEnrollForm.reset();
    }
    if (index !== 0) {
      this.selectedStudent.set(null);
      this.enrollForm.reset();
    }
  }
}
