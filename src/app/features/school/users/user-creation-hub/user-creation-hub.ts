// user-creation-hub.ts

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../../core/services/api.service';
import {
  UsersService,
  CreateUserPayload,
  SOCIAL_CATEGORY_LABELS,
  RELIGION_LABELS,
  DISABILITY_TYPE_LABELS,
  FACILITY_LABELS,
  FacilityReceived,
  SocialCategory,
  Religion,
  DisabilityType,
} from '../../../../core/services/users.service';
import { ToastService } from '../../../../core/services/toast.service';
import { StudentParentsManager } from '../../../school/parents/student-parents-manager/student-parents-manager';
import { RoleCategory } from '../../../../core/services/roles.service';
import { INDIAN_DATE_PROVIDERS } from '../../../../core/adapters/indian-date-adapter';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RolePersona {
  id: string;
  roleName: string;
  label: string;
  tagline: string;
  icon: string;
  color: string;
  bgClass: string;
  steps: StepDef[];
}

export interface StepDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
}

export interface RoleOption {
  id: number;
  name: string;
  description?: string;
  isSystem?: boolean;
  category?: RoleCategory;
}

type EmailCheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

// ── Personas ───────────────────────────────────────────────────────────────────

export const ROLE_PERSONAS: RolePersona[] = [
  {
    id: 'student',
    roleName: 'STUDENT',
    label: 'Admit Student',
    tagline: 'Enrol a new learner into the school',
    icon: 'school',
    color: '#10b981',
    bgClass: 'student',
    steps: [
      { id: 'account', title: 'Account', subtitle: 'Login credentials', icon: 'lock' },
      { id: 'personal', title: 'Personal', subtitle: 'Student details', icon: 'person' },
      {
        id: 'guardian',
        title: 'Guardian',
        subtitle: 'Parent & family info',
        icon: 'family_restroom',
      },
      { id: 'academic', title: 'Academic', subtitle: 'Admission & school info', icon: 'class' },
      { id: 'udise', title: 'UDISE+', subtitle: 'Government data fields', icon: 'assignment_ind' },
      {
        id: 'parents',
        title: 'Parents',
        subtitle: 'Link guardians',
        icon: 'supervised_user_circle',
      },
    ],
  },
  {
    id: 'teacher',
    roleName: 'TEACHER',
    label: 'Hire Teacher',
    tagline: 'Onboard a new teaching staff member',
    icon: 'cast_for_education',
    color: '#3b82f6',
    bgClass: 'teacher',
    steps: [
      { id: 'account', title: 'Account', subtitle: 'Login credentials', icon: 'lock' },
      { id: 'personal', title: 'Personal', subtitle: 'Contact & address', icon: 'person' },
      {
        id: 'guardian',
        title: 'Emergency Contact',
        subtitle: 'Family & guardian info',
        icon: 'family_restroom',
      },
      {
        id: 'teaching',
        title: 'Teaching Profile',
        subtitle: 'Qualification & exp',
        icon: 'cast_for_education',
      },
    ],
  },
  {
    id: 'parent',
    roleName: 'STUDENT_PARENT',
    label: 'Add Parent',
    tagline: 'Register a parent or guardian account',
    icon: 'family_restroom',
    color: '#f59e0b',
    bgClass: 'parent',
    steps: [
      { id: 'account', title: 'Account', subtitle: 'Login credentials', icon: 'lock' },
      { id: 'personal', title: 'Personal', subtitle: 'Contact details', icon: 'person' },
      { id: 'profile', title: 'Profile', subtitle: 'Occupation info', icon: 'work' },
    ],
  },
  {
    id: 'staff',
    roleName: 'STAFF',
    label: 'Add Staff',
    tagline: 'Create any other staff or management role',
    icon: 'badge',
    color: '#8b5cf6',
    bgClass: 'staff',
    steps: [
      { id: 'role', title: 'Role', subtitle: 'Pick a role', icon: 'badge' },
      { id: 'account', title: 'Account', subtitle: 'Login credentials', icon: 'lock' },
      { id: 'personal', title: 'Personal', subtitle: 'Contact & address', icon: 'person' },
      {
        id: 'guardian',
        title: 'Emergency Contact',
        subtitle: 'Family info',
        icon: 'family_restroom',
      },
      { id: 'work', title: 'Work', subtitle: 'Department & shift', icon: 'work' },
    ],
  },
  {
    id: 'bulk',
    roleName: '',
    label: 'Bulk Upload',
    tagline: 'Add many students at once via Excel',
    icon: 'upload_file',
    color: '#06b6d4',
    bgClass: 'bulk',
    steps: [],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-user-creation-hub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatTooltipModule,
    StudentParentsManager,
  ],
  templateUrl: './user-creation-hub.html',
  styleUrl: './user-creation-hub.scss',
})
export class UserCreationHub implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private usersService = inject(UsersService);
  private toast = inject(ToastService);
  private datePipe = inject(DatePipe);
  readonly router = inject(Router);

  // ── UI state ───────────────────────────────────────────────────────────────
  personas = ROLE_PERSONAS;
  selectedPersona = signal<RolePersona | null>(null);
  currentStep = signal(0);
  submitting = signal(false);
  loadingRoles = signal(false);
  createdUserId = signal<number | null>(null);
  availableRoles = signal<RoleOption[]>([]);

  // Email check
  emailCheckStatus = signal<EmailCheckStatus>('idle');
  emailCheckMessage = signal<string>('');
  private emailCheckSubject = new Subject<string>();

  // ── Static option lists ────────────────────────────────────────────────────
  readonly bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  readonly genders = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'TRANSGENDER', label: 'Transgender' },
  ];
  readonly shifts = [
    { value: 'MORNING', label: 'Morning' },
    { value: 'AFTERNOON', label: 'Afternoon' },
    { value: 'EVENING', label: 'Evening' },
  ];
  readonly enrollmentTypes = [
    { value: 'REGULAR', label: 'Regular' },
    { value: 'PRIVATE', label: 'Private Candidate' },
    { value: 'OPEN_SCHOOL', label: 'Open School (NIOS)' },
  ];
  readonly previousClassResults = [
    { value: 'NEW_ADMISSION', label: 'New Admission (First time)' },
    { value: 'PROMOTED', label: 'Promoted from previous class' },
    { value: 'NOT_PROMOTED', label: 'Not Promoted / Detained' },
    { value: 'TRANSFERRED', label: 'Transferred from another school' },
  ];
  readonly socialCategories = Object.entries(SOCIAL_CATEGORY_LABELS).map(([value, label]) => ({
    value: Number(value),
    label,
  }));
  readonly religions = Object.entries(RELIGION_LABELS).map(([value, label]) => ({
    value: Number(value),
    label,
  }));
  readonly disabilityTypes = Object.entries(DISABILITY_TYPE_LABELS).map(([value, label]) => ({
    value: Number(value),
    label,
  }));
  readonly facilityOptions: { value: FacilityReceived; label: string }[] = Object.entries(
    FACILITY_LABELS
  ).map(([value, label]) => ({ value: value as FacilityReceived, label }));
  readonly localityTypes = [
    { value: 'URBAN', label: 'Urban' },
    { value: 'RURAL', label: 'Rural' },
  ];

  // ── Computed ───────────────────────────────────────────────────────────────
  steps = computed(() => this.selectedPersona()?.steps ?? []);
  isLastStep = computed(() => this.currentStep() === this.steps().length - 1);
  isFirstStep = computed(() => this.currentStep() === 0);
  progress = computed(() => {
    const total = this.steps().length;
    if (total === 0) return 0;
    return Math.round(((this.currentStep() + 1) / total) * 100);
  });

  staffRoleSearch = signal('');
  filteredStaffRoles = computed(() => {
    const q = this.staffRoleSearch().toLowerCase();
    const EXCLUDED_NAMES = ['STUDENT', 'STUDENT_PARENT', 'TEACHER', 'SCHOOL_OWNER'];
    return this.availableRoles().filter((r) => {
      const nameExcluded = EXCLUDED_NAMES.some((ex) => r.name.toUpperCase().includes(ex));
      if (nameExcluded) return false;
      if (r.category && r.category !== 'staff') return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });
  selectedStaffRole = signal<RoleOption | null>(null);
  emailVerified = computed(() => this.emailCheckStatus() === 'available');

  // ── UDISE step: isCwsn toggle ──────────────────────────────────────────────
  showCwsnFields = computed(() => !!this.udiseForm.get('isCwsn')?.value);

  // ── Forms ──────────────────────────────────────────────────────────────────

  accountForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  personalForm = this.fb.group({
    phone: ['', [Validators.minLength(10), Validators.maxLength(15)]],
    alternatePhone: [''],
    dateOfBirth: [null as Date | null],
    gender: [''],
    bloodGroup: [''],
    addressLineOne: [''],
    city: [''],
    state: [''],
    postalCode: [''],
  });

  /** Guardian / family fields — new for all user types */
  guardianForm = this.fb.group({
    fatherName: ['', Validators.maxLength(150)],
    motherName: ['', Validators.maxLength(150)],
    guardianName: ['', Validators.maxLength(150)],
    guardianRelation: ['', Validators.maxLength(100)],
  });

  /** Student academic (school-internal) fields */
  studentAcademicForm = this.fb.group({
    admissionNumber: ['', Validators.maxLength(50)],
    admissionDate: [null as Date | null],
    previousSchool: [''],
    previousSchoolUdiseCode: ['', [Validators.pattern(/^\d{11}$|^$/)]], // 11 digits or empty
    medicalInfo: [''],
    enrollmentType: ['REGULAR'],
    previousClassResult: [''],
  });

  /** UDISE+ government data fields — student only */
  udiseForm = this.fb.group({
    // National identity
    pen: ['', [Validators.pattern(/^\d{16}$|^$/)]],
    apaarId: ['', [Validators.pattern(/^\d{12}$|^$/)]],
    stateStudentId: ['', Validators.maxLength(50)],
    aadhaarMasked: ['', [Validators.pattern(/^XXXX XXXX \d{4}$|^$/)]],
    aadhaarName: ['', Validators.maxLength(150)],
    // Demographic
    socialCategory: [null as number | null],
    religion: [null as number | null],
    isMinority: [false],
    motherTongueCode: [null as number | null],
    // Socio-economic
    isBpl: [false],
    localityType: [''],
    // CWSN
    isCwsn: [false],
    disabilityType: [null as number | null],
    hasDisabilityCertificate: [false],
    udidNumber: ['', Validators.maxLength(30)],
    // Facilities (multi-select stored as array)
    facilitiesReceived: [[] as string[]],
    // Verification
    isAadhaarVerified: [false],
    udiseVerified: [false],
  });

  teachingForm = this.fb.group({
    qualification: [''],
    experienceYears: [null as number | null, Validators.min(0)],
    specialization: [''],
    joiningDate: [null as Date | null],
  });

  parentProfileForm = this.fb.group({
    occupation: [''],
  });

  staffWorkForm = this.fb.group({
    department: [''],
    salary: [null as number | null, Validators.min(0)],
    shift: [''],
    joiningDate: [null as Date | null],
  });

  constructor() {
    this.emailCheckSubject
      .pipe(
        debounceTime(600),
        distinctUntilChanged(),
        switchMap((email) => {
          if (!email || !this.isValidEmailFormat(email)) {
            this.emailCheckStatus.set('idle');
            this.emailCheckMessage.set('');
            return of(null);
          }
          this.emailCheckStatus.set('checking');
          const params = new HttpParams().set('email', email);
          return this.api.get<{ success: boolean; available: boolean; message: string }>(
            'school/users/check-email',
            params
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (res) => {
          if (!res) return;
          if (res.available) {
            this.emailCheckStatus.set('available');
            this.emailCheckMessage.set(res.message);
          } else {
            this.emailCheckStatus.set('taken');
            this.emailCheckMessage.set(res.message);
          }
        },
        error: () => {
          this.emailCheckStatus.set('error');
          this.emailCheckMessage.set('Could not verify email. You may proceed.');
        },
      });
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.loadingRoles.set(true);
    this.api.get<{ success: boolean; roles: RoleOption[] }>('school/roles').subscribe({
      next: (res) => {
        this.availableRoles.set(res.roles ?? []);
        this.loadingRoles.set(false);
      },
      error: () => {
        this.toast.error('Could not load roles');
        this.loadingRoles.set(false);
      },
    });
  }

  private isValidEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  onEmailInput(event: Event): void {
    const email = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.emailCheckStatus.set('idle');
    this.emailCheckMessage.set('');
    this.emailCheckSubject.next(email);
  }

  checkEmailNow(): void {
    const email = this.accountForm.get('email')?.value?.trim().toLowerCase() ?? '';
    if (!email || !this.isValidEmailFormat(email)) {
      this.toast.error('Please enter a valid email address first.');
      return;
    }
    this.emailCheckStatus.set('checking');
    const params = new HttpParams().set('email', email);
    this.api
      .get<{ success: boolean; available: boolean; message: string }>(
        'school/users/check-email',
        params
      )
      .subscribe({
        next: (res) => {
          if (res.available) {
            this.emailCheckStatus.set('available');
            this.emailCheckMessage.set(res.message);
          } else {
            this.emailCheckStatus.set('taken');
            this.emailCheckMessage.set(res.message);
          }
        },
        error: () => {
          this.emailCheckStatus.set('error');
          this.emailCheckMessage.set('Could not verify email. You may proceed.');
        },
      });
  }

  // ── Persona selection ──────────────────────────────────────────────────────

  selectPersona(persona: RolePersona): void {
    if (persona.id === 'bulk') {
      this.router.navigate(['/school/students/bulk-upload']);
      return;
    }
    this.selectedPersona.set(persona);
    this.currentStep.set(0);
    this.createdUserId.set(null);
    this.resetForms();
  }

  private resetForms(): void {
    this.accountForm.reset();
    this.personalForm.reset();
    this.guardianForm.reset();
    this.studentAcademicForm.reset({ enrollmentType: 'REGULAR' });
    this.udiseForm.reset({
      isCwsn: false,
      isMinority: false,
      isBpl: false,
      isAadhaarVerified: false,
      udiseVerified: false,
      hasDisabilityCertificate: false,
      facilitiesReceived: [],
    });
    this.teachingForm.reset();
    this.parentProfileForm.reset();
    this.staffWorkForm.reset();
    this.selectedStaffRole.set(null);
    this.staffRoleSearch.set('');
    this.emailCheckStatus.set('idle');
    this.emailCheckMessage.set('');
  }

  backToHub(): void {
    this.selectedPersona.set(null);
    this.currentStep.set(0);
    this.createdUserId.set(null);
    this.resetForms();
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  currentStepId = computed(() => this.steps()[this.currentStep()]?.id ?? '');

  getActiveForm() {
    const stepId = this.currentStepId();
    if (stepId === 'account') return this.accountForm;
    if (stepId === 'personal') return this.personalForm;
    if (stepId === 'guardian') return this.guardianForm;
    if (stepId === 'academic') return this.studentAcademicForm;
    if (stepId === 'udise') return this.udiseForm;
    if (stepId === 'teaching') return this.teachingForm;
    if (stepId === 'profile') return this.parentProfileForm;
    if (stepId === 'work') return this.staffWorkForm;
    return null;
  }

  canProceed(): boolean {
    const stepId = this.currentStepId();

    if (stepId === 'role') return this.selectedStaffRole() !== null;
    if (stepId === 'parents') return true;
    if (stepId === 'guardian') return true; // all optional fields
    if (stepId === 'udise') return true; // all optional fields

    if (stepId === 'account') {
      const form = this.accountForm;
      if (!form.valid) return false;
      const status = this.emailCheckStatus();
      return status === 'available' || status === 'error';
    }

    const form = this.getActiveForm();
    return form ? form.valid : true;
  }

  next(): void {
    const stepId = this.currentStepId();
    const persona = this.selectedPersona();

    if (stepId === 'parents') {
      this.router.navigate(['/school/users']);
      return;
    }

    const form = this.getActiveForm();
    if (form && form.invalid && stepId !== 'guardian' && stepId !== 'udise') {
      form.markAllAsTouched();
      return;
    }

    if (stepId === 'account') {
      const status = this.emailCheckStatus();
      if (status === 'taken') {
        this.toast.error('Please use a different email address.');
        return;
      }
      if (status === 'idle' || status === 'checking') {
        this.toast.error('Please wait for email verification to complete.');
        return;
      }
    }

    // Trigger submit on last data-collection step
    const isStudentUdiseStep = persona?.id === 'student' && stepId === 'udise';
    const isNonStudentLastStep = this.isLastStep() && stepId !== 'parents';

    if (isStudentUdiseStep || isNonStudentLastStep) {
      this.submitUser();
      return;
    }

    this.currentStep.update((s) => s + 1);
  }

  prev(): void {
    if (this.isFirstStep()) {
      this.backToHub();
      return;
    }
    this.currentStep.update((s) => s - 1);
  }

  onStaffRoleSearchInput(event: Event): void {
    this.staffRoleSearch.set((event.target as HTMLInputElement).value);
  }

  selectStaffRole(role: RoleOption): void {
    this.selectedStaffRole.set(role);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  private fmt(date: Date | string | null): string | undefined {
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? undefined;
  }

  submitUser(): void {
    const persona = this.selectedPersona();
    if (!persona) return;

    const acc = this.accountForm.value;
    const per = this.personalForm.value;
    const grd = this.guardianForm.value;

    let primaryRoleId: number | null = null;
    if (persona.id === 'staff') {
      primaryRoleId = this.selectedStaffRole()?.id ?? null;
    } else {
      const found = this.availableRoles().find((r) => r.name === persona.roleName);
      primaryRoleId = found?.id ?? null;
    }

    if (!primaryRoleId) {
      this.toast.error('Role not found. Please refresh and try again.');
      return;
    }

    const payload: CreateUserPayload = {
      name: acc.name!.trim(),
      email: acc.email!.trim().toLowerCase(),
      password: acc.password!,
      primaryRoleId,
      roleIds: [primaryRoleId],
      // Personal
      phone: per.phone?.trim() || undefined,
      alternatePhone: per.alternatePhone?.trim() || undefined,
      dateOfBirth: per.dateOfBirth ? this.fmt(per.dateOfBirth) : undefined,
      gender: per.gender || undefined,
      bloodGroup: per.bloodGroup || undefined,
      addressLineOne: per.addressLineOne?.trim() || undefined,
      city: per.city?.trim() || undefined,
      state: per.state?.trim() || undefined,
      postalCode: per.postalCode?.trim() || undefined,
      // Guardian / parental (new)
      fatherName: grd.fatherName?.trim() || undefined,
      motherName: grd.motherName?.trim() || undefined,
      guardianName: grd.guardianName?.trim() || undefined,
      guardianRelation: grd.guardianRelation?.trim() || undefined,
    };

    if (persona.id === 'student') {
      const aca = this.studentAcademicForm.value;
      const udi = this.udiseForm.value;

      // Academic fields
      payload.admissionNumber = aca.admissionNumber?.trim() || undefined;
      payload.admissionDate = aca.admissionDate ? this.fmt(aca.admissionDate) : undefined;
      payload.previousSchool = aca.previousSchool?.trim() || undefined;
      payload.previousSchoolUdiseCode = aca.previousSchoolUdiseCode?.trim() || undefined;
      payload.medicalInfo = aca.medicalInfo?.trim() || undefined;
      payload.enrollmentType = (aca.enrollmentType as any) || 'REGULAR';
      payload.previousClassResult = (aca.previousClassResult as any) || undefined;

      // UDISE+ national identity
      payload.pen = udi.pen?.trim() || undefined;
      payload.apaarId = udi.apaarId?.trim() || undefined;
      payload.stateStudentId = udi.stateStudentId?.trim() || undefined;
      payload.aadhaarMasked = udi.aadhaarMasked?.trim() || undefined;
      payload.aadhaarName = udi.aadhaarName?.trim() || undefined;

      // UDISE+ demographic
      payload.socialCategory =
  udi.socialCategory != null
    ? (udi.socialCategory as unknown as SocialCategory)
    : undefined;
    payload.religion =
    udi.religion != null
      ? (udi.religion as unknown as Religion)
      : undefined;
      payload.isMinority = udi.isMinority ?? false;
      payload.motherTongueCode = udi.motherTongueCode ?? undefined;

      // Socio-economic
      payload.isBpl = udi.isBpl ?? false;
      payload.localityType = (udi.localityType as any) || undefined;

      // CWSN
      payload.isCwsn = udi.isCwsn ?? false;
      if (udi.isCwsn) {
        payload.disabilityType =
    udi.disabilityType != null
      ? (udi.disabilityType as unknown as DisabilityType)
      : undefined;
        payload.hasDisabilityCertificate = udi.hasDisabilityCertificate ?? false;
        payload.udidNumber = udi.udidNumber?.trim() || undefined;
      }

      // Facilities
      payload.facilitiesReceived = (udi.facilitiesReceived as any[]) ?? [];

      // Verification
      payload.isAadhaarVerified = udi.isAadhaarVerified ?? false;
      payload.udiseVerified = udi.udiseVerified ?? false;
    }

    if (persona.id === 'teacher') {
      const tch = this.teachingForm.value;
      payload.qualification = tch.qualification?.trim() || undefined;
      payload.experienceYears = tch.experienceYears ?? undefined;
      payload.specialization = tch.specialization?.trim() || undefined;
      payload.joiningDate = tch.joiningDate ? this.fmt(tch.joiningDate) : undefined;
    }

    if (persona.id === 'parent') {
      const par = this.parentProfileForm.value;
      payload.occupation = par.occupation?.trim() || undefined;
    }

    if (persona.id === 'staff') {
      const wrk = this.staffWorkForm.value;
      payload.department = wrk.department?.trim() || undefined;
      payload.salary = wrk.salary ?? undefined;
      payload.shift = wrk.shift || undefined;
      payload.joiningDate = wrk.joiningDate ? this.fmt(wrk.joiningDate) : undefined;
    }

    this.submitting.set(true);

    this.usersService.createUser(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const newUserId = (res as any).user?.id ?? null;
        this.createdUserId.set(newUserId);

        if (persona.id === 'student') {
          this.toast.success(`${acc.name} admitted successfully!`);
          this.currentStep.set(this.steps().length - 1); // jump to parents step
        } else {
          this.toast.success(`${acc.name} created successfully!`);
          this.router.navigate(['/school/users']);
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to create user');
        this.submitting.set(false);
      },
    });
  }

  skipParents(): void {
    this.router.navigate(['/school/users']);
  }

  goToUsersList(): void {
    this.router.navigate(['/school/users']);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatRoleName(name: string): string {
    return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  getRoleIcon(name: string): string {
    const u = name.toUpperCase();
    if (u.includes('PRINCIPAL')) return 'account_balance';
    if (u.includes('MANAGER')) return 'manage_accounts';
    if (u.includes('ACCOUNTANT')) return 'account_balance_wallet';
    if (u.includes('LIBRARIAN')) return 'local_library';
    if (u.includes('TRANSPORT')) return 'directions_bus';
    if (u.includes('SECURITY')) return 'security';
    if (u.includes('CANTEEN')) return 'restaurant';
    if (u.includes('NURSE')) return 'medical_services';
    if (u.includes('ADMISSION')) return 'how_to_reg';
    if (u.includes('OWNER')) return 'star';
    return 'badge';
  }

  isFacilitySelected(value: FacilityReceived): boolean {
    const facilities: string[] = this.udiseForm.get('facilitiesReceived')?.value ?? [];
    return facilities.includes(value);
  }

  toggleFacility(value: FacilityReceived): void {
    const ctrl = this.udiseForm.get('facilitiesReceived');
    if (!ctrl) return;
    const current: string[] = ctrl.value ?? [];
    if (current.includes(value)) {
      ctrl.setValue(current.filter((f) => f !== value));
    } else {
      ctrl.setValue([...current, value]);
    }
  }

  getStepLabel(step: StepDef, index: number): string {
    return `Step ${index + 1}: ${step.title}`;
  }
}
