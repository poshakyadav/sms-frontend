import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { StudentsService } from '../../../../core/services/students.service';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import { PromoteStudentsDialogComponent } from '../promote-students-dialog/promote-students-dialog';
import { UnenrollStudentDialog } from '../../academics/unenroll/unenroll-student-dialog/unenroll-student-dialog';
import { AssignRollNumbersDialog } from '../assign-roll-numbers-dialog/assign-roll-numbers-dialog';

export interface StudentInClassSection {
  id: number;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  isActive: boolean;
  rollNumber?: string;
  admissionDate?: string;
  enrollmentId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  enrollmentDate?: string;
  academicYearId: number;
}

@Component({
  selector: 'app-students-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDialogModule,
    MatChipsModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './students-list.html',
  styleUrl: './students-list.scss',
})
export class StudentsList implements OnInit {
  private studentsService = inject(StudentsService);
  private academicsService = inject(AcademicsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);

  // ── State ─────────────────────────────────────────────────────────────────
  classSections = signal<ClassSection[]>([]);
  students = signal<StudentInClassSection[]>([]);
  selectedClassSectionId = signal<number | null>(null);
  selectedStudentIds = signal<Set<number>>(new Set());

  loadingClassSections = signal(true);
  loadingStudents = signal(false);
  error = signal<string | null>(null);
  searchQuery = signal('');

  displayedColumns = ['select', 'rollNumber', 'name', 'gender', 'bloodGroup', 'status', 'actions'];

  // ── PBAC ──────────────────────────────────────────────────────────────────
  canPromote = computed(() => this.auth.hasPermission('academics.enroll'));
  canUnenroll = computed(() => this.auth.hasPermission('academics.unenroll'));
  canViewFees = computed(() => this.auth.hasPermission('fees.report'));
  canViewAttendance = computed(() => this.auth.hasPermission('attendance.student.view'));
  // Assign roll numbers requires the same enroll permission (backed by academics.enroll on the API)
  canAssignRollNumbers = computed(() => this.auth.hasPermission('academics.enroll'));

  // ── Computed ──────────────────────────────────────────────────────────────
  selectedClassSection = computed(() =>
    this.classSections().find((cs) => cs.id === this.selectedClassSectionId())
  );

  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.students();
    return this.students().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.rollNumber ?? '').toLowerCase().includes(q)
    );
  });

  allSelected = computed(() => {
    const ids = this.filteredStudents().map((s) => s.id);
    return ids.length > 0 && ids.every((id) => this.selectedStudentIds().has(id));
  });

  someSelected = computed(() => {
    const ids = this.filteredStudents().map((s) => s.id);
    return ids.some((id) => this.selectedStudentIds().has(id)) && !this.allSelected();
  });

  selectedCount = computed(() => this.selectedStudentIds().size);
  totalStudents = computed(() => this.students().length);
  activeStudents = computed(() => this.students().filter((s) => s.isActive).length);

  // True if ANY student in the current class-section already has a roll number assigned
  hasExistingRollNumbers = computed(() =>
    this.students().some((s) => !!s.rollNumber && s.rollNumber !== '—')
  );

  ngOnInit(): void {
    this.loadClassSections();
  }

  loadClassSections(): void {
    this.loadingClassSections.set(true);
    this.academicsService.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections ?? []);
        this.loadingClassSections.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load class sections');
        this.loadingClassSections.set(false);
      },
    });
  }

  onClassSectionChange(classSectionId: number): void {
    this.selectedClassSectionId.set(classSectionId);
    this.selectedStudentIds.set(new Set());
    this.searchQuery.set('');
    this.loadStudents(classSectionId);
  }

  loadStudents(classSectionId: number): void {
    this.loadingStudents.set(true);
    this.error.set(null);

    this.studentsService.getStudentsByClassSection(classSectionId).subscribe({
      next: (res) => {
        this.students.set(res.students ?? []);
        this.loadingStudents.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load students');
        this.toast.error(this.error()!);
        this.loadingStudents.set(false);
      },
    });
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  isSelected(id: number): boolean {
    return this.selectedStudentIds().has(id);
  }

  toggleSelect(id: number): void {
    const current = new Set(this.selectedStudentIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedStudentIds.set(current);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedStudentIds.set(new Set());
    } else {
      this.selectedStudentIds.set(new Set(this.filteredStudents().map((s) => s.id)));
    }
  }

  clearSelection(): void {
    this.selectedStudentIds.set(new Set());
  }

  // ── Promote ───────────────────────────────────────────────────────────────
  openPromoteDialog(studentIds: number[]): void {
    const classSectionId = this.selectedClassSectionId();
    if (!classSectionId) return;

    const studentNames = this.students()
      .filter((s) => studentIds.includes(s.id))
      .map((s) => s.name);

    const ref = this.dialog.open(PromoteStudentsDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        studentIds,
        studentNames,
        currentClassSectionId: classSectionId,
        classSections: this.classSections(),
        currentClassName: this.selectedClassSection()?.className,
        currentSectionName: this.selectedClassSection()?.sectionName,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.clearSelection();
        if (classSectionId) this.loadStudents(classSectionId);
        this.toast.success(result.message || 'Students promoted successfully');
      }
    });
  }

  promoteSingle(student: StudentInClassSection, event: Event): void {
    event.stopPropagation();
    this.openPromoteDialog([student.id]);
  }

  promoteSelected(): void {
    this.openPromoteDialog([...this.selectedStudentIds()]);
  }

  // ── Unenroll ──────────────────────────────────────────────────────────────
  openUnenrollDialog(student: StudentInClassSection, event: Event): void {
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

        // Optimistic UI — remove from list immediately (student is no longer enrolled)
        this.students.update((list) => list.filter((s) => s.id !== student.id));

        // Also clean up selection if this student was selected
        this.selectedStudentIds.update((set) => {
          const next = new Set(set);
          next.delete(student.id);
          return next;
        });
      }
    });
  }

  // ── Assign Roll Numbers ───────────────────────────────────────────────────
  openAssignRollNumbersDialog(): void {
    const classSectionId = this.selectedClassSectionId();
    const cs = this.selectedClassSection();
    if (!classSectionId || !cs) return;

    const ref = this.dialog.open(AssignRollNumbersDialog, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        classSectionId,
        className: cs.className,
        sectionName: cs.sectionName,
        studentCount: this.students().length,
        hasExistingRollNumbers: this.hasExistingRollNumbers(),
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.success) {
        // Reload so roll numbers are shown immediately in the table
        this.loadStudents(classSectionId);
      }
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  trackById(_: number, item: StudentInClassSection): number {
    return item.id;
  }
}
