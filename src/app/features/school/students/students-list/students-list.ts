// students-list.ts

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
import {
  StudentsService,
  StudentInClassSection,
  SOCIAL_CATEGORY_LABELS,
  RELIGION_LABELS,
  DISABILITY_TYPE_LABELS,
  FACILITY_LABELS,
  PREVIOUS_CLASS_RESULT_LABELS,
  ENROLLMENT_TYPE_LABELS,
  SocialCategory,
  Religion,
  DisabilityType,
  FacilityReceived,
  PreviousClassResult,
  EnrollmentType,
} from '../../../../core/services/students.service';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import { PromoteStudentsDialogComponent } from '../promote-students-dialog/promote-students-dialog';
import { UnenrollStudentDialog } from '../../academics/unenroll/unenroll-student-dialog/unenroll-student-dialog';
import { AssignRollNumbersDialog } from '../assign-roll-numbers-dialog/assign-roll-numbers-dialog';

// ── Column group definitions ──────────────────────────────────────────────────

export type ColumnGroup =
  | 'core'
  | 'personal'
  | 'guardian'
  | 'academic'
  | 'udise'
  | 'demographic'
  | 'socioeconomic'
  | 'cwsn';

export interface ColumnDef {
  key: string;
  label: string;
  group: ColumnGroup;
  always?: boolean; // always shown, cannot be toggled
}

export const ALL_COLUMNS: ColumnDef[] = [
  // Core (always visible)
  { key: 'select', label: 'Select', group: 'core', always: true },
  { key: 'rollNumber', label: 'Roll No.', group: 'core', always: true },
  { key: 'name', label: 'Student', group: 'core', always: true },
  { key: 'status', label: 'Status', group: 'core', always: true },
  // Personal
  { key: 'gender', label: 'Gender', group: 'personal' },
  { key: 'dateOfBirth', label: 'Date of Birth', group: 'personal' },
  { key: 'bloodGroup', label: 'Blood Group', group: 'personal' },
  { key: 'phone', label: 'Phone', group: 'personal' },
  // Guardian
  { key: 'fatherName', label: "Father's Name", group: 'guardian' },
  { key: 'motherName', label: "Mother's Name", group: 'guardian' },
  { key: 'guardianName', label: 'Guardian', group: 'guardian' },
  // Academic
  { key: 'admissionNumber', label: 'Admission No.', group: 'academic' },
  { key: 'admissionDate', label: 'Admission Date', group: 'academic' },
  { key: 'enrollmentType', label: 'Enrollment Type', group: 'academic' },
  { key: 'previousSchool', label: 'Previous School', group: 'academic' },
  { key: 'previousClassResult', label: 'Prev. Result', group: 'academic' },
  // UDISE
  { key: 'pen', label: 'PEN', group: 'udise' },
  { key: 'apaarId', label: 'APAAR ID', group: 'udise' },
  { key: 'stateStudentId', label: 'State Student ID', group: 'udise' },
  { key: 'aadhaarMasked', label: 'Aadhaar (Masked)', group: 'udise' },
  { key: 'udiseVerified', label: 'UDISE Verified', group: 'udise' },
  // Demographic
  { key: 'socialCategory', label: 'Social Category', group: 'demographic' },
  { key: 'religion', label: 'Religion', group: 'demographic' },
  { key: 'isMinority', label: 'Minority', group: 'demographic' },
  { key: 'localityType', label: 'Locality', group: 'demographic' },
  // Socio-economic
  { key: 'isBpl', label: 'BPL', group: 'socioeconomic' },
  { key: 'facilitiesReceived', label: 'Facilities', group: 'socioeconomic' },
  // CWSN
  { key: 'isCwsn', label: 'CWSN', group: 'cwsn' },
  { key: 'disabilityType', label: 'Disability Type', group: 'cwsn' },
  // Actions (always)
  { key: 'actions', label: 'Actions', group: 'core', always: true },
];

export const COLUMN_GROUP_LABELS: Record<ColumnGroup, string> = {
  core: 'Core',
  personal: 'Personal',
  guardian: 'Guardian / Parent',
  academic: 'Academic',
  udise: 'UDISE+ Identity',
  demographic: 'Demographic',
  socioeconomic: 'Socio-Economic',
  cwsn: 'CWSN',
};

export const COLUMN_GROUP_ICONS: Record<ColumnGroup, string> = {
  core: 'grid_on',
  personal: 'person',
  guardian: 'family_restroom',
  academic: 'school',
  udise: 'badge',
  demographic: 'groups',
  socioeconomic: 'volunteer_activism',
  cwsn: 'accessibility_new',
};

// Default visible columns (beyond the always-true ones)
const DEFAULT_VISIBLE: string[] = [
  'gender',
  'dateOfBirth',
  'bloodGroup',
  'phone',
  'fatherName',
  'admissionNumber',
];

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

  // ── State ──────────────────────────────────────────────────────────────────
  classSections = signal<ClassSection[]>([]);
  students = signal<StudentInClassSection[]>([]);
  selectedClassSectionId = signal<number | null>(null);
  selectedStudentIds = signal<Set<number>>(new Set());
  loadingClassSections = signal(true);
  loadingStudents = signal(false);
  error = signal<string | null>(null);
  searchQuery = signal('');

  // Column visibility state — key → boolean
  columnVisibility = signal<Record<string, boolean>>(
    Object.fromEntries(
      ALL_COLUMNS.filter((c) => !c.always).map((c) => [c.key, DEFAULT_VISIBLE.includes(c.key)])
    )
  );

  // Column group panel open/closed
  columnPanelOpen = signal(false);

  // Expanded row for UDISE detail drawer
  expandedRowId = signal<number | null>(null);

  // ── PBAC ───────────────────────────────────────────────────────────────────
  canPromote = computed(() => this.auth.hasPermission('academics.enroll'));
  canUnenroll = computed(() => this.auth.hasPermission('academics.unenroll'));
  canViewFees = computed(() => this.auth.hasPermission('fees.report'));
  canViewAttendance = computed(() => this.auth.hasPermission('attendance.student.view'));
  canAssignRollNumbers = computed(() => this.auth.hasPermission('academics.enroll'));

  // ── Label helpers (exposed to template) ───────────────────────────────────
  readonly SOCIAL_CATEGORY_LABELS = SOCIAL_CATEGORY_LABELS;
  readonly RELIGION_LABELS = RELIGION_LABELS;
  readonly DISABILITY_TYPE_LABELS = DISABILITY_TYPE_LABELS;
  readonly FACILITY_LABELS = FACILITY_LABELS;
  readonly PREVIOUS_CLASS_RESULT_LABELS = PREVIOUS_CLASS_RESULT_LABELS;
  readonly ENROLLMENT_TYPE_LABELS = ENROLLMENT_TYPE_LABELS;
  readonly COLUMN_GROUP_LABELS = COLUMN_GROUP_LABELS;
  readonly COLUMN_GROUP_ICONS = COLUMN_GROUP_ICONS;
  readonly columnGroups = Object.keys(COLUMN_GROUP_LABELS).filter(
    (g) => g !== 'core'
  ) as ColumnGroup[];
  readonly allColumns = ALL_COLUMNS;

  // ── Computed ───────────────────────────────────────────────────────────────
  selectedClassSection = computed(() =>
    this.classSections().find((cs) => cs.id === this.selectedClassSectionId())
  );

  /** Ordered list of column keys that should currently be shown */
  displayedColumns = computed<string[]>(() => {
    const vis = this.columnVisibility();
    return ALL_COLUMNS.filter((c) => c.always || vis[c.key]).map((c) => c.key);
  });

  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.students();
    return this.students().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.rollNumber ?? '').toLowerCase().includes(q) ||
        (s.admissionNumber ?? '').toLowerCase().includes(q) ||
        (s.fatherName ?? '').toLowerCase().includes(q) ||
        (s.motherName ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').includes(q)
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
  cwsnCount = computed(() => this.students().filter((s) => s.isCwsn).length);
  bplCount = computed(() => this.students().filter((s) => s.isBpl).length);
  udiseComplete = computed(() => this.students().filter((s) => s.udiseVerified).length);

  hasExistingRollNumbers = computed(() =>
    this.students().some((s) => !!s.rollNumber && s.rollNumber !== '—')
  );

  /** Columns in a given group that are toggleable */
  columnsInGroup(group: ColumnGroup): ColumnDef[] {
    return ALL_COLUMNS.filter((c) => c.group === group && !c.always);
  }

  /** How many columns in a group are currently visible */
  visibleCountInGroup(group: ColumnGroup): number {
    const vis = this.columnVisibility();
    return this.columnsInGroup(group).filter((c) => vis[c.key]).length;
  }

  ngOnInit(): void {
    this.loadClassSections();
  }

  // ── Data loading ───────────────────────────────────────────────────────────
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
    this.expandedRowId.set(null);
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

  // ── Column visibility ──────────────────────────────────────────────────────
  toggleColumn(key: string): void {
    this.columnVisibility.update((vis) => ({ ...vis, [key]: !vis[key] }));
  }

  isColumnVisible(key: string): boolean {
    return !!this.columnVisibility()[key];
  }

  toggleGroupColumns(group: ColumnGroup, show: boolean): void {
    const cols = this.columnsInGroup(group).map((c) => c.key);
    this.columnVisibility.update((vis) => {
      const next = { ...vis };
      cols.forEach((k) => (next[k] = show));
      return next;
    });
  }

  resetColumns(): void {
    this.columnVisibility.set(
      Object.fromEntries(
        ALL_COLUMNS.filter((c) => !c.always).map((c) => [c.key, DEFAULT_VISIBLE.includes(c.key)])
      )
    );
  }

  // ── Row expand (UDISE detail drawer) ──────────────────────────────────────
  toggleExpand(id: number, event: Event): void {
    event.stopPropagation();
    this.expandedRowId.update((cur) => (cur === id ? null : id));
  }

  isExpanded(id: number): boolean {
    return this.expandedRowId() === id;
  }

  // ── Selection ──────────────────────────────────────────────────────────────
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

  // ── Dialogs ────────────────────────────────────────────────────────────────
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

  openUnenrollDialog(student: StudentInClassSection, event: Event): void {
    event.stopPropagation();

    const ref = this.dialog.open(UnenrollStudentDialog, {
      width: '580px',
      maxWidth: '95vw',
      disableClose: true,
      data: { studentId: student.id, studentName: student.name },
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.toast.success(result.message);
        this.students.update((list) => list.filter((s) => s.id !== student.id));
        this.selectedStudentIds.update((set) => {
          const next = new Set(set);
          next.delete(student.id);
          return next;
        });
      }
    });
  }

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
        this.loadStudents(classSectionId);
      }
    });
  }

  // ── Label helpers ──────────────────────────────────────────────────────────
  getSocialCategoryLabel(val?: SocialCategory | null): string {
    return val != null ? SOCIAL_CATEGORY_LABELS[val] ?? String(val) : '—';
  }

  getReligionLabel(val?: Religion | null): string {
    return val != null ? RELIGION_LABELS[val] ?? String(val) : '—';
  }

  getDisabilityLabel(val?: DisabilityType | null): string {
    return val != null ? DISABILITY_TYPE_LABELS[val] ?? String(val) : '—';
  }

  getFacilityLabel(val: FacilityReceived): string {
    return FACILITY_LABELS[val] ?? val;
  }

  getPreviousResultLabel(val?: PreviousClassResult | null): string {
    return val != null ? PREVIOUS_CLASS_RESULT_LABELS[val] ?? val : '—';
  }

  getEnrollmentTypeLabel(val?: EnrollmentType | null): string {
    return val != null ? ENROLLMENT_TYPE_LABELS[val] ?? val : '—';
  }

  hasMedicalInfo(s: StudentInClassSection): boolean {
    return !!(s.medicalInfo && s.medicalInfo.trim().length > 0);
  }

  hasUdiseData(s: StudentInClassSection): boolean {
    return !!(
      s.pen ||
      s.apaarId ||
      s.stateStudentId ||
      s.aadhaarMasked ||
      s.socialCategory ||
      s.religion ||
      s.isCwsn ||
      s.isBpl ||
      (s.facilitiesReceived && s.facilitiesReceived.length > 0)
    );
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  }

  toggleColumnPanel(): void {
    this.columnPanelOpen.update((v) => !v);
  }

  trackById(_: number, item: StudentInClassSection): number {
    return item.id;
  }
}
