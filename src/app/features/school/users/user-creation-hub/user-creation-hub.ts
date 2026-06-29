// user-creation-hub.ts
// ENHANCED: Aadhaar auto-prefix XXXX XXXX, Indian states dropdown (searchable),
// UDISE+ mother tongue codes dropdown (searchable), all production-grade.

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
import { AvatarPicker } from '../../../../shared/components/avatar-picker/avatar-picker';
import { UserAvatarService } from '../../../../core/services/user-avatar.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RolePersona {
  id: string;
  roleName: string;
  /** Permission category used to fetch this persona's system role. */
  roleCategory: RoleCategory | null;
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

// ── Indian States (2026 — includes all 28 states + 8 UTs) ─────────────────────

export interface IndianStateOption {
  code: string;
  name: string;
  type: 'state' | 'ut';
}

export const INDIAN_STATES: IndianStateOption[] = [
  // States
  { code: 'AP', name: 'Andhra Pradesh', type: 'state' },
  { code: 'AR', name: 'Arunachal Pradesh', type: 'state' },
  { code: 'AS', name: 'Assam', type: 'state' },
  { code: 'BR', name: 'Bihar', type: 'state' },
  { code: 'CG', name: 'Chhattisgarh', type: 'state' },
  { code: 'GA', name: 'Goa', type: 'state' },
  { code: 'GJ', name: 'Gujarat', type: 'state' },
  { code: 'HR', name: 'Haryana', type: 'state' },
  { code: 'HP', name: 'Himachal Pradesh', type: 'state' },
  { code: 'JH', name: 'Jharkhand', type: 'state' },
  { code: 'KA', name: 'Karnataka', type: 'state' },
  { code: 'KL', name: 'Kerala', type: 'state' },
  { code: 'MP', name: 'Madhya Pradesh', type: 'state' },
  { code: 'MH', name: 'Maharashtra', type: 'state' },
  { code: 'MN', name: 'Manipur', type: 'state' },
  { code: 'ML', name: 'Meghalaya', type: 'state' },
  { code: 'MZ', name: 'Mizoram', type: 'state' },
  { code: 'NL', name: 'Nagaland', type: 'state' },
  { code: 'OD', name: 'Odisha', type: 'state' },
  { code: 'PB', name: 'Punjab', type: 'state' },
  { code: 'RJ', name: 'Rajasthan', type: 'state' },
  { code: 'SK', name: 'Sikkim', type: 'state' },
  { code: 'TN', name: 'Tamil Nadu', type: 'state' },
  { code: 'TG', name: 'Telangana', type: 'state' },
  { code: 'TR', name: 'Tripura', type: 'state' },
  { code: 'UP', name: 'Uttar Pradesh', type: 'state' },
  { code: 'UK', name: 'Uttarakhand', type: 'state' },
  { code: 'WB', name: 'West Bengal', type: 'state' },
  // Union Territories
  { code: 'AN', name: 'Andaman & Nicobar Islands', type: 'ut' },
  { code: 'CH', name: 'Chandigarh', type: 'ut' },
  { code: 'DN', name: 'Dadra & Nagar Haveli and Daman & Diu', type: 'ut' },
  { code: 'DL', name: 'Delhi', type: 'ut' },
  { code: 'JK', name: 'Jammu & Kashmir', type: 'ut' },
  { code: 'LA', name: 'Ladakh', type: 'ut' },
  { code: 'LD', name: 'Lakshadweep', type: 'ut' },
  { code: 'PY', name: 'Puducherry', type: 'ut' },
];

// ── UDISE+ Mother Tongue Codes (Census of India — 2011 schedule, used in UDISE+) ─

export interface MotherTongueOption {
  code: number;
  name: string;
  script?: string;
}

/**
 * UDISE+ uses the Census of India 2011 language codes.
 * These are the scheduled + major non-scheduled languages that appear
 * in the UDISE+ student data capture forms.
 * Source: Census of India Language Codes + UDISE+ DCF mapping.
 */
export const MOTHER_TONGUE_OPTIONS: MotherTongueOption[] = [
  // 22 Scheduled Languages (Eighth Schedule)
  { code: 1, name: 'Assamese', script: 'Assamese' },
  { code: 2, name: 'Bengali', script: 'Bengali' },
  { code: 3, name: 'Bodo', script: 'Devanagari' },
  { code: 4, name: 'Dogri', script: 'Devanagari' },
  { code: 5, name: 'Gujarati', script: 'Gujarati' },
  { code: 6, name: 'Hindi', script: 'Devanagari' },
  { code: 7, name: 'Kannada', script: 'Kannada' },
  { code: 8, name: 'Kashmiri', script: 'Nastaliq / Devanagari' },
  { code: 9, name: 'Konkani', script: 'Devanagari' },
  { code: 10, name: 'Maithili', script: 'Devanagari' },
  { code: 11, name: 'Malayalam', script: 'Malayalam' },
  { code: 12, name: 'Manipuri (Meitei)', script: 'Meitei Mayek' },
  { code: 13, name: 'Marathi', script: 'Devanagari' },
  { code: 14, name: 'Nepali', script: 'Devanagari' },
  { code: 15, name: 'Odia', script: 'Odia' },
  { code: 16, name: 'Punjabi', script: 'Gurmukhi' },
  { code: 17, name: 'Sanskrit', script: 'Devanagari' },
  { code: 18, name: 'Santali', script: 'Ol Chiki' },
  { code: 19, name: 'Sindhi', script: 'Devanagari / Khudabadi' },
  { code: 20, name: 'Tamil', script: 'Tamil' },
  { code: 21, name: 'Telugu', script: 'Telugu' },
  { code: 22, name: 'Urdu', script: 'Nastaliq' },
  // Major non-scheduled / tribal languages present in UDISE+ DCF
  { code: 23, name: 'Bhojpuri', script: 'Devanagari' },
  { code: 24, name: 'Chhattisgarhi', script: 'Devanagari' },
  { code: 25, name: 'Garo', script: 'Latin / Bengali' },
  { code: 26, name: 'Gondi', script: 'Devanagari' },
  { code: 27, name: 'Haryanvi', script: 'Devanagari' },
  { code: 28, name: 'Ho', script: 'Warang Citi / Devanagari' },
  { code: 29, name: 'Khasi', script: 'Latin' },
  { code: 30, name: 'Kokborok', script: 'Bengali / Latin' },
  { code: 31, name: 'Kumaoni', script: 'Devanagari' },
  { code: 32, name: 'Kurukh (Oraon)', script: 'Devanagari' },
  { code: 33, name: 'Ladakhi', script: 'Tibetan' },
  { code: 34, name: 'Lepcha', script: 'Lepcha' },
  { code: 35, name: 'Limboo', script: 'Sirijonga' },
  { code: 36, name: 'Lushai (Mizo)', script: 'Latin' },
  { code: 37, name: 'Magahi', script: 'Devanagari' },
  { code: 38, name: 'Munda', script: 'Devanagari' },
  { code: 39, name: 'Mundari', script: 'Warang Citi / Devanagari' },
  { code: 40, name: 'Nagamese', script: 'Latin' },
  { code: 41, name: 'Rajasthani', script: 'Devanagari' },
  { code: 42, name: 'Santhali', script: 'Ol Chiki' },
  { code: 43, name: 'Shekhawati', script: 'Devanagari' },
  { code: 44, name: 'Tulu', script: 'Kannada / Tulu' },
  { code: 45, name: 'Angami', script: 'Latin' },
  { code: 46, name: 'Ao', script: 'Latin' },
  { code: 47, name: 'Banjari', script: 'Devanagari' },
  { code: 48, name: 'Chattisgarhi Gondi', script: 'Devanagari' },
  // English — official language in Meghalaya, Nagaland, Arunachal Pradesh,
  // Sikkim, and widely used as medium of instruction across India
  { code: 50, name: 'English', script: 'Latin' },
  { code: 99, name: 'Other Language', script: '' },
];

// ── Personas ───────────────────────────────────────────────────────────────────

export const ROLE_PERSONAS: RolePersona[] = [
  {
    id: 'student',
    roleName: 'STUDENT',
    roleCategory: 'student',
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
    roleCategory: 'staff',
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
    roleCategory: 'parent',
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
    roleCategory: 'staff',
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
    roleCategory: null,
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
    AvatarPicker,
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

  private avatarService = inject(UserAvatarService);

  // ── UI state ───────────────────────────────────────────────────────────────
  personas = ROLE_PERSONAS;
  selectedPersona = signal<RolePersona | null>(null);
  currentStep = signal(0);
  submitting = signal(false);
  loadingRoles = signal(false);
  createdUserId = signal<number | null>(null);

  /** Compressed avatar file selected during the Account step, held in memory
   *  until the user record is actually created (no userId exists before
   *  that point — see AvatarPicker's "deferred mode" when no [userId] input
   *  is bound). Cleared on resetForms() / persona switch. */
  pendingAvatarFile = signal<File | null>(null);

  /**
   * availableRoles holds ALL roles loaded from the backend.
   * For the staff persona's role-picker it is filtered by filteredStaffRoles().
   * For student/teacher/parent personas it is searched by roleName on submit.
   */
  availableRoles = signal<RoleOption[]>([]);

  // Email check
  emailCheckStatus = signal<EmailCheckStatus>('idle');
  emailCheckMessage = signal<string>('');
  private emailCheckSubject = new Subject<string>();

  // ── State/Language search signals ─────────────────────────────────────────
  stateSearch = signal('');
  motherTongueSearch = signal('');

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

  // All states (for dropdown)
  readonly allStates = INDIAN_STATES;

  // All mother tongue options (for dropdown)
  readonly allMotherTongues = MOTHER_TONGUE_OPTIONS;

  // ── Filtered computed options ──────────────────────────────────────────────
  filteredStates = computed(() => {
    const q = this.stateSearch().toLowerCase().trim();
    if (!q) return this.allStates;
    return this.allStates.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  });

  filteredMotherTongues = computed(() => {
    const q = this.motherTongueSearch().toLowerCase().trim();
    if (!q) return this.allMotherTongues;
    return this.allMotherTongues.filter(
      (mt) =>
        mt.name.toLowerCase().includes(q) ||
        String(mt.code).includes(q) ||
        (mt.script?.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Pre-computed booleans for template type safety ─────────────────────────
  hasFilteredStates = computed(() => this.filteredStates().some((s) => s.type === 'state'));
  hasFilteredUTs = computed(() => this.filteredStates().some((s) => s.type === 'ut'));

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
    state: [''], // stores state name
    postalCode: [''],
  });

  /** Guardian / family fields */
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
    // Aadhaar — only last 4 digits entered by user; prefix is auto-applied
    aadhaarLast4: ['', [Validators.pattern(/^\d{4}$|^$/)]],
    aadhaarName: ['', Validators.maxLength(150)],
    // Demographic
    socialCategory: [null as number | null],
    religion: [null as number | null],
    isMinority: [false],
    motherTongueCode: [null as number | null], // stored as integer code
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
    // Pre-load all roles for the staff persona role-picker.
    // For student/teacher/parent personas, roles are fetched by category on demand.
    this.loadAllRoles();
  }

  // ── Role loading ───────────────────────────────────────────────────────────

  /**
   * Load all roles (requires roles.manage). Used for the staff role picker.
   * Failure is silent — non-staff personas use loadRolesByCategory() instead.
   */
  private loadAllRoles(): void {
    this.loadingRoles.set(true);
    this.api.get<{ success: boolean; roles: RoleOption[] }>('school/roles').subscribe({
      next: (res) => {
        this.availableRoles.set(res.roles ?? []);
        this.loadingRoles.set(false);
      },
      error: () => {
        // Non-fatal: staff persona will show empty list; other personas
        // use loadRolesByCategory() which doesn't need roles.manage.
        this.availableRoles.set([]);
        this.loadingRoles.set(false);
      },
    });
  }

  /**
   * Load roles filtered by category. Used as a fallback when loadAllRoles()
   * returns nothing (e.g. user lacks roles.manage permission).
   * Returns a Promise so submitUser() can await it inline.
   */
  private loadRolesByCategory(category: RoleCategory): Promise<RoleOption[]> {
    const params = new HttpParams().set('category', category);
    return new Promise((resolve) => {
      this.api.get<{ success: boolean; roles: RoleOption[] }>('school/roles', params).subscribe({
        next: (res) => resolve(res.roles ?? []),
        error: () => resolve([]),
      });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── State search ───────────────────────────────────────────────────────────
  onStateSearchInput(event: Event): void {
    this.stateSearch.set((event.target as HTMLInputElement).value);
  }

  clearStateSearch(): void {
    this.stateSearch.set('');
  }

  // ── Mother tongue search ───────────────────────────────────────────────────
  onMotherTongueSearchInput(event: Event): void {
    this.motherTongueSearch.set((event.target as HTMLInputElement).value);
  }

  clearMotherTongueSearch(): void {
    this.motherTongueSearch.set('');
  }

  /** Display label for the currently selected mother tongue code */
  getMotherTongueLabel(code: number | null): string {
    if (code == null) return '';
    const found = MOTHER_TONGUE_OPTIONS.find((mt) => mt.code === code);
    return found ? `${found.name} (${found.code})` : String(code);
  }

  /** Display label for the currently selected state */
  getStateLabel(stateName: string | null): string {
    return stateName ?? '';
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

    // Pre-fetch roles by category for non-staff personas so they're ready
    // at submit time without an extra round trip.
    // For the staff persona, loadAllRoles() already ran in ngOnInit.
    if (persona.roleCategory && persona.id !== 'staff') {
      this.loadRolesByCategory(persona.roleCategory).then((roles) => {
        // Merge into availableRoles so the name-lookup in submitUser() succeeds
        // without disturbing the staff role picker (which uses filteredStaffRoles).
        const existing = this.availableRoles();
        const existingIds = new Set(existing.map((r) => r.id));
        const merged = [...existing, ...roles.filter((r) => !existingIds.has(r.id))];
        this.availableRoles.set(merged);
      });
    }
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
    this.stateSearch.set('');
    this.motherTongueSearch.set('');
    this.emailCheckStatus.set('idle');
    this.emailCheckMessage.set('');
    this.pendingAvatarFile.set(null);
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
    if (stepId === 'guardian') return true;
    if (stepId === 'udise') return true;

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

  onAvatarSelected(file: File): void {
    this.pendingAvatarFile.set(file);
  }

  onAvatarRemoved(): void {
    this.pendingAvatarFile.set(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  private fmt(date: Date | string | null): string | undefined {
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? undefined;
  }

  /** Build the full masked Aadhaar from the last 4 digits. */
  private buildAadhaarMasked(last4: string | null | undefined): string | undefined {
    if (!last4 || !/^\d{4}$/.test(last4.trim())) return undefined;
    return `XXXX XXXX ${last4.trim()}`;
  }

  async submitUser(): Promise<void> {
    const persona = this.selectedPersona();
    if (!persona) return;

    const acc = this.accountForm.value;
    const per = this.personalForm.value;
    const grd = this.guardianForm.value;

    // ── Resolve primaryRoleId ──────────────────────────────────────────────
    let primaryRoleId: number | null = null;

    if (persona.id === 'staff') {
      // Staff: user explicitly selected a role in the role step
      primaryRoleId = this.selectedStaffRole()?.id ?? null;
      if (!primaryRoleId) {
        this.toast.error('Please select a role first.');
        return;
      }
    } else {
      // Student / Teacher / Parent: find the system role by name.
      // 1. Try already-loaded availableRoles first (fast path).
      const fromCache = this.availableRoles().find((r) => r.name === persona.roleName);
      if (fromCache) {
        primaryRoleId = fromCache.id;
      } else {
        // 2. Fallback: fetch by category (handles the case where the user lacks
        //    roles.manage and loadAllRoles() returned an empty list).
        if (!persona.roleCategory) {
          this.toast.error('Cannot determine role category. Please refresh and try again.');
          return;
        }
        this.submitting.set(true);
        const roles = await this.loadRolesByCategory(persona.roleCategory);
        const match = roles.find((r) => r.name === persona.roleName);
        if (!match) {
          this.submitting.set(false);
          this.toast.error(
            `System role "${persona.roleName}" not found. Please contact your administrator.`
          );
          return;
        }
        primaryRoleId = match.id;
        // Cache it so a retry doesn't need another round trip
        const existing = this.availableRoles();
        const existingIds = new Set(existing.map((r) => r.id));
        if (!existingIds.has(match.id)) {
          this.availableRoles.set([...existing, match]);
        }
      }
    }

    // ── Build payload ──────────────────────────────────────────────────────
    const payload: CreateUserPayload = {
      name: acc.name!.trim(),
      email: acc.email!.trim().toLowerCase(),
      password: acc.password!,
      primaryRoleId,
      roleIds: [primaryRoleId],
      phone: per.phone?.trim() || undefined,
      alternatePhone: per.alternatePhone?.trim() || undefined,
      dateOfBirth: per.dateOfBirth ? this.fmt(per.dateOfBirth) : undefined,
      gender: per.gender || undefined,
      bloodGroup: per.bloodGroup || undefined,
      addressLineOne: per.addressLineOne?.trim() || undefined,
      city: per.city?.trim() || undefined,
      state: per.state || undefined,
      postalCode: per.postalCode?.trim() || undefined,
      fatherName: grd.fatherName?.trim() || undefined,
      motherName: grd.motherName?.trim() || undefined,
      guardianName: grd.guardianName?.trim() || undefined,
      guardianRelation: grd.guardianRelation?.trim() || undefined,
    };

    if (persona.id === 'student') {
      const aca = this.studentAcademicForm.value;
      const udi = this.udiseForm.value;

      payload.admissionNumber = aca.admissionNumber?.trim() || undefined;
      payload.admissionDate = aca.admissionDate ? this.fmt(aca.admissionDate) : undefined;
      payload.previousSchool = aca.previousSchool?.trim() || undefined;
      payload.previousSchoolUdiseCode = aca.previousSchoolUdiseCode?.trim() || undefined;
      payload.medicalInfo = aca.medicalInfo?.trim() || undefined;
      payload.enrollmentType = (aca.enrollmentType as any) || 'REGULAR';
      payload.previousClassResult = (aca.previousClassResult as any) || undefined;

      payload.pen = udi.pen?.trim() || undefined;
      payload.apaarId = udi.apaarId?.trim() || undefined;
      payload.stateStudentId = udi.stateStudentId?.trim() || undefined;
      payload.aadhaarMasked = this.buildAadhaarMasked((udi as any).aadhaarLast4);
      payload.aadhaarName = udi.aadhaarName?.trim() || undefined;

      payload.socialCategory =
        udi.socialCategory != null ? (udi.socialCategory as unknown as SocialCategory) : undefined;
      payload.religion = udi.religion != null ? (udi.religion as unknown as Religion) : undefined;
      payload.isMinority = udi.isMinority ?? false;
      payload.motherTongueCode = udi.motherTongueCode ?? undefined;

      payload.isBpl = udi.isBpl ?? false;
      payload.localityType = (udi.localityType as any) || undefined;

      payload.isCwsn = udi.isCwsn ?? false;
      if (udi.isCwsn) {
        payload.disabilityType =
          udi.disabilityType != null
            ? (udi.disabilityType as unknown as DisabilityType)
            : undefined;
        payload.hasDisabilityCertificate = udi.hasDisabilityCertificate ?? false;
        payload.udidNumber = udi.udidNumber?.trim() || undefined;
      }

      payload.facilitiesReceived = (udi.facilitiesReceived as any[]) ?? [];
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

    // ── Send ───────────────────────────────────────────────────────────────
    this.submitting.set(true);

    this.usersService.createUser(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const newUserId = (res as any).user?.id ?? null;
        this.createdUserId.set(newUserId);

        // ── NEW: upload the staged avatar now that the user exists ──────────
        const photo = this.pendingAvatarFile();
        if (newUserId && photo) {
          this.avatarService.uploadAvatar(newUserId, photo).subscribe({
            next: () => {
              // Non-blocking — the user record itself already succeeded, so
              // we don't want a photo-upload hiccup to look like the whole
              // creation failed. Just inform and move on.
              this.toast.success(`${acc.name} admitted successfully!`);
            },
            error: () => {
              // Creation still succeeded; only the photo failed. Tell the
              // admin so they can retry from the edit screen, but don't block
              // navigation — the rest of the account is fully usable.
              this.toast.error(
                `${acc.name} was created, but the profile photo failed to upload. You can add it from Edit User.`
              );
            },
          });
        } else if (persona.id !== 'student') {
          this.toast.success(`${acc.name} created successfully!`);
        }

        if (persona.id === 'student') {
          this.toast.success(`${acc.name} admitted successfully!`);
          this.currentStep.set(this.steps().length - 1);
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

  /** Preview the composed masked Aadhaar for the hint text */
  get aadhaarPreview(): string {
    const last4 = this.udiseForm.get('aadhaarLast4')?.value?.trim();
    if (!last4) return 'XXXX XXXX ____';
    if (!/^\d{1,4}$/.test(last4)) return 'XXXX XXXX ____';
    return `XXXX XXXX ${last4.padEnd(4, '_')}`;
  }
}
