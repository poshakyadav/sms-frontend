// user-form/user-form.ts
// PRODUCTION-GRADE — Mobile-first, category-filtered roles, full UDISE+,
// 3-state permission model, confirm-before-save.

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, Pipe, PipeTransform, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpParams } from '@angular/common/http';
import { INDIAN_DATE_PROVIDERS } from '../../../../core/adapters/indian-date-adapter';
import { ApiService } from '../../../../core/services/api.service';
import { Permission, RoleCategory, RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CreateUserPayload,
  DISABILITY_TYPE_LABELS,
  DisabilityType,
  FACILITY_LABELS,
  FacilityReceived,
  Religion,
  RELIGION_LABELS,
  SOCIAL_CATEGORY_LABELS,
  SocialCategory,
  UpdateUserPayload,
  UsersService,
} from '../../../../core/services/users.service';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RoleOption {
  id: number;
  name: string;
  description?: string;
  isSystem?: boolean;
  category?: RoleCategory;
}

interface FieldChange {
  label: string;
  oldValue: string;
  newValue: string;
  field: string;
}

interface PermModuleGroup {
  module: string;
  permissions: Permission[];
  expanded: boolean;
}

export type PermissionState = 'inherited' | 'granted' | 'denied' | 'none';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Derives the RoleCategory from a primaryRole name string.
 * Maps STUDENT → student, STUDENT_PARENT → parent, everything else → staff.
 */
function derivePermissionCategory(primaryRole: string): RoleCategory {
  const upper = primaryRole.toUpperCase().trim();
  if (upper === 'STUDENT') return 'student';
  if (upper === 'STUDENT_PARENT') return 'parent';
  return 'staff';
}

/**
 * Maps a primaryRole name to the RoleCategory used for filtering the
 * "Additional Roles" dropdown. Mirrors the backend's category system:
 *   staff category   → roles with category='staff'
 *   student category → roles with category='student'
 *   parent category  → roles with category='parent'
 */
function primaryRoleToCategory(primaryRole: string): RoleCategory {
  return derivePermissionCategory(primaryRole);
}

// ── Pipe ───────────────────────────────────────────────────────────────────────

@Pipe({ name: 'findById', standalone: true, pure: false })
export class FindByIdPipe implements PipeTransform {
  transform(items: RoleOption[], id: number): RoleOption | undefined {
    return items.find((r) => r.id === id);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    FindByIdPipe,
  ],
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnInit {
  // ── DI ──────────────────────────────────────────────────────────────────────
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private usersService = inject(UsersService);
  private rolesService = inject(RolesService);
  private toast = inject(ToastService);
  private datePipe = inject(DatePipe);

  // ── Core state ───────────────────────────────────────────────────────────────
  isEdit = signal(false);
  userId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);

  /** All roles of the user's category (drives the Additional Roles dropdown). */
  availableRoles = signal<RoleOption[]>([]);
  loadingRoles = signal(false);

  primaryRoleName = signal<string>('');
  primaryRoleId = signal<number | null>(null);

  editableFields = signal<Set<string>>(new Set());

  showConfirmDialog = signal(false);
  pendingChanges = signal<FieldChange[]>([]);
  originalValues = signal<Record<string, any>>({});

  guideExpanded = signal(false);

  // ── Section collapse state ────────────────────────────────────────────────
  sectionExpanded = signal<Record<string, boolean>>({
    account: true,
    personal: true,
    address: false,
    guardian: false,
    studentProfile: true,
    teacherProfile: true,
    parentProfile: true,
    staffProfile: true,
    permissions: false,
  });

  // ── Permission section ────────────────────────────────────────────────────
  permSectionUnlocked = signal(false);
  loadingPermissions = signal(false);
  savingPermissions = signal(false);

  allCategoryPermissions = signal<Permission[]>([]);
  permModuleGroups = signal<PermModuleGroup[]>([]);
  permissionSearch = signal('');

  roleInheritedPermissionIds = signal<Set<number>>(new Set());
  directGrantIds = signal<Set<number>>(new Set());
  directDenyIds = signal<Set<number>>(new Set());
  originalGrantIds = signal<Set<number>>(new Set());
  originalDenyIds = signal<Set<number>>(new Set());

  // ── Static options ────────────────────────────────────────────────────────
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
    { value: 'NEW_ADMISSION', label: 'New Admission' },
    { value: 'PROMOTED', label: 'Promoted' },
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

  // ── Computed: filtered perm groups ────────────────────────────────────────
  filteredPermGroups = computed(() => {
    const q = this.permissionSearch().toLowerCase().trim();
    if (!q) return this.permModuleGroups();
    return this.permModuleGroups()
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) => p.slug.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
        ),
        expanded: true,
      }))
      .filter((g) => g.permissions.length > 0);
  });

  grantCount = computed(() => this.directGrantIds().size);
  denyCount = computed(() => this.directDenyIds().size);
  totalPermCount = computed(() => this.allCategoryPermissions().length);
  totalActiveOverrides = computed(() => this.originalGrantIds().size + this.originalDenyIds().size);

  hasPermissionChanges = computed(() => {
    const og = this.originalGrantIds();
    const od = this.originalDenyIds();
    const cg = this.directGrantIds();
    const cd = this.directDenyIds();
    if (cg.size !== og.size || cd.size !== od.size) return true;
    for (const id of cg) if (!og.has(id)) return true;
    for (const id of cd) if (!od.has(id)) return true;
    return false;
  });

  permCategoryLabel = computed(() => {
    const cat = derivePermissionCategory(this.primaryRoleName());
    const labels: Record<RoleCategory, string> = {
      staff: 'Staff',
      student: 'Student',
      parent: 'Parent',
    };
    return labels[cat];
  });

  /** Category derived from primaryRole — used for section visibility & role filtering */
  userCategory = computed<RoleCategory>(() => primaryRoleToCategory(this.primaryRoleName()));

  // ── Profile section flags ─────────────────────────────────────────────────
  selectedRoleNames = computed(() => {
    const roleIds: number[] = this.form?.get('roleIds')?.value ?? [];
    return this.availableRoles()
      .filter((r) => roleIds.includes(r.id))
      .map((r) => r.name.toUpperCase());
  });

  showStudentFields = computed(() => {
    if (this.isEdit()) {
      const p = this.primaryRoleName().toUpperCase();
      return p.includes('STUDENT') && !p.includes('PARENT');
    }
    return this.selectedRoleNames().some((n) => n.includes('STUDENT') && !n.includes('PARENT'));
  });

  showTeacherFields = computed(() => {
    if (this.isEdit()) return this.primaryRoleName().toUpperCase().includes('TEACHER');
    return this.selectedRoleNames().some((n) => n.includes('TEACHER'));
  });

  showParentFields = computed(() => {
    if (this.isEdit()) return this.primaryRoleName().toUpperCase().includes('PARENT');
    return this.selectedRoleNames().some((n) => n.includes('PARENT'));
  });

  showStaffFields = computed(() => {
    if (this.isEdit()) {
      const p = this.primaryRoleName().toUpperCase();
      return (
        p.length > 0 && !p.includes('STUDENT') && !p.includes('TEACHER') && !p.includes('PARENT')
      );
    }
    const names = this.selectedRoleNames();
    if (names.length === 0) return false;
    return names.some(
      (n) => !n.includes('STUDENT') && !n.includes('TEACHER') && !n.includes('PARENT')
    );
  });

  showCwsnFields = computed(() => !!this.form?.get('isCwsn')?.value);

  // ── Field labels ──────────────────────────────────────────────────────────
  private readonly fieldLabels: Record<string, string> = {
    name: 'Full Name',
    email: 'Email Address',
    newPassword: 'New Password',
    roleIds: 'Assigned Roles',
    phone: 'Primary Phone',
    alternatePhone: 'Alternate Phone',
    dateOfBirth: 'Date of Birth',
    gender: 'Gender',
    bloodGroup: 'Blood Group',
    addressLineOne: 'Address Line 1',
    addressLineTwo: 'Address Line 2',
    city: 'City',
    state: 'State / Province',
    postalCode: 'Postal Code',
    fatherName: "Father's Name",
    motherName: "Mother's Name",
    guardianName: "Guardian's Name",
    guardianRelation: 'Guardian Relation',
    admissionNumber: 'Admission Number',
    rollNumber: 'Roll Number',
    admissionDate: 'Admission Date',
    previousSchool: 'Previous School',
    medicalInfo: 'Medical Information',
    enrollmentType: 'Enrollment Type',
    previousClassResult: 'Previous Class Result',
    previousSchoolUdiseCode: 'Previous School UDISE Code',
    pen: 'PEN',
    apaarId: 'APAAR ID',
    stateStudentId: 'State Student ID',
    aadhaarMasked: 'Aadhaar (Masked)',
    aadhaarName: 'Aadhaar Name',
    socialCategory: 'Social Category',
    religion: 'Religion',
    isMinority: 'Minority',
    isBpl: 'BPL Status',
    localityType: 'Locality Type',
    isCwsn: 'CWSN',
    isAadhaarVerified: 'Aadhaar Verified',
    udiseVerified: 'UDISE+ Verified',
    qualification: 'Qualification',
    experienceYears: 'Experience (Years)',
    specialization: 'Specialization',
    occupation: 'Occupation',
    department: 'Department',
    salary: 'Salary',
    shift: 'Shift',
    joiningDate: 'Joining Date',
    isActive: 'Account Status',
  };

  // ── Category label helper ─────────────────────────────────────────────────
  get currentCategoryLabel(): string {
    const labels: Record<RoleCategory, string> = {
      staff: 'Staff',
      student: 'Student',
      parent: 'Parent',
    };
    return labels[this.userCategory()] ?? 'User';
  }

  get currentCategoryIcon(): string {
    const icons: Record<RoleCategory, string> = {
      staff: 'badge',
      student: 'school',
      parent: 'family_restroom',
    };
    return icons[this.userCategory()] ?? 'person';
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    primaryRoleId: [null as number | null],
    roleIds: [[] as number[], [Validators.required, this.minArrayLength(1)]],
    phone: ['', [Validators.minLength(10), Validators.maxLength(15)]],
    alternatePhone: ['', [Validators.minLength(10), Validators.maxLength(15)]],
    dateOfBirth: [null as Date | null],
    gender: ['' as string],
    bloodGroup: ['' as string],
    addressLineOne: ['', Validators.maxLength(255)],
    addressLineTwo: ['', Validators.maxLength(255)],
    city: ['', Validators.maxLength(100)],
    state: ['', Validators.maxLength(100)],
    postalCode: ['', Validators.maxLength(20)],
    fatherName: ['', Validators.maxLength(150)],
    motherName: ['', Validators.maxLength(150)],
    guardianName: ['', Validators.maxLength(150)],
    guardianRelation: ['', Validators.maxLength(100)],
    admissionNumber: ['', Validators.maxLength(50)],
    rollNumber: [''],
    admissionDate: [null as Date | null],
    previousSchool: [''],
    medicalInfo: [''],
    enrollmentType: ['REGULAR'],
    previousClassResult: [''],
    previousSchoolUdiseCode: ['', [Validators.pattern(/^\d{11}$|^$/)]],
    pen: ['', [Validators.pattern(/^\d{16}$|^$/)]],
    apaarId: ['', [Validators.pattern(/^\d{12}$|^$/)]],
    stateStudentId: ['', Validators.maxLength(50)],
    aadhaarMasked: ['', [Validators.pattern(/^XXXX XXXX \d{4}$|^$/)]],
    aadhaarName: ['', Validators.maxLength(150)],
    socialCategory: [null as number | null],
    religion: [null as number | null],
    isMinority: [false],
    motherTongueCode: [null as number | null],
    isBpl: [false],
    localityType: [''],
    isCwsn: [false],
    disabilityType: [null as number | null],
    hasDisabilityCertificate: [false],
    udidNumber: ['', Validators.maxLength(30)],
    facilitiesReceived: [[] as string[]],
    isAadhaarVerified: [false],
    udiseVerified: [false],
    qualification: [''],
    experienceYears: [null as number | null, Validators.min(0)],
    specialization: [''],
    occupation: [''],
    department: [''],
    salary: [null as number | null, Validators.min(0)],
    shift: ['' as string],
    joiningDate: [null as Date | null],
    isActive: [true],
    newPassword: ['', [Validators.minLength(8)]],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      // ── EDIT MODE ────────────────────────────────────────────────────────
      this.isEdit.set(true);
      this.userId.set(+id);
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
      this.disableAllFields();
      // loadUser will set primaryRoleName, which triggers loadRolesForCategory
      this.loadUser(+id);
    } else {
      // ── CREATE MODE ──────────────────────────────────────────────────────
      this.form.get('primaryRoleId')?.setValidators([Validators.required]);
      this.form.get('primaryRoleId')?.updateValueAndValidity();

      // On primaryRoleId change: derive category, reload roles, auto-add to roleIds
      this.form.get('primaryRoleId')?.valueChanges.subscribe((primaryId) => {
        if (!primaryId) return;

        // Find the selected role to get its category
        const selectedRole = this.availableRoles().find((r) => r.id === primaryId);
        if (selectedRole?.category) {
          // Reload available roles filtered to this category
          this.loadRolesForCategory(selectedRole.category, primaryId);
        }

        // Ensure primaryRoleId is always in roleIds
        const currentRoleIds: number[] = this.form.get('roleIds')?.value ?? [];
        if (!currentRoleIds.includes(primaryId)) {
          this.form.get('roleIds')?.setValue([...currentRoleIds, primaryId]);
        }
      });

      // Initial load: fetch ALL roles so the Primary Role dropdown is complete
      this.loadAllRolesForPrimaryPicker();
    }
  }

  // ── Role loading ───────────────────────────────────────────────────────────

  /**
   * CREATE mode: loads all roles (unfiltered) for the Primary Role dropdown.
   * The Additional Roles dropdown is reloaded with category filter after
   * the user picks a primary role.
   */
  private loadAllRolesForPrimaryPicker(): void {
    this.loadingRoles.set(true);
    this.api.get<{ success: boolean; roles: RoleOption[] }>('school/roles').subscribe({
      next: (res) => {
        this.availableRoles.set(res.roles ?? []);
        this.loadingRoles.set(false);
      },
      error: () => {
        this.toast.error('Could not load roles list');
        this.loadingRoles.set(false);
      },
    });
  }

  /**
   * Loads roles filtered to the given category.
   * Called after a primary role is selected (create) or after the user is
   * loaded (edit). In edit mode `primaryId` is the ID of the primary role
   * which must always remain in the list even if the category filter yields
   * an empty set (defensive).
   *
   * The backend GET /school/roles?category=<cat> returns only roles of that
   * category — preventing cross-category assignments from the UI.
   */
  loadRolesForCategory(category: RoleCategory, primaryId?: number | null): void {
    this.loadingRoles.set(true);
    const params = new HttpParams().set('category', category);
    this.api.get<{ success: boolean; roles: RoleOption[] }>('school/roles', params).subscribe({
      next: (res) => {
        let roles = res.roles ?? [];

        // Defensive: always ensure the primary role is in the list
        if (primaryId && !roles.find((r) => r.id === primaryId)) {
          const existing = this.availableRoles().find((r) => r.id === primaryId);
          if (existing) roles = [existing, ...roles];
        }

        this.availableRoles.set(roles);
        this.loadingRoles.set(false);

        // Resolve primaryRoleId signal if needed (edit mode sets primaryRoleName first)
        if (!this.primaryRoleId()) {
          const found = roles.find((r) => r.name === this.primaryRoleName());
          if (found) this.primaryRoleId.set(found.id);
        }
      },
      error: () => {
        this.toast.error('Could not load roles list');
        this.loadingRoles.set(false);
      },
    });
  }

  // ── Field lock / unlock ────────────────────────────────────────────────────

  isFieldEditable(fieldName: string): boolean {
    return this.editableFields().has(fieldName);
  }

  toggleFieldEdit(fieldName: string, event?: Event): void {
    event?.stopPropagation();
    const fields = new Set(this.editableFields());
    if (fields.has(fieldName)) {
      fields.delete(fieldName);
      const original = this.originalValues();
      if (original[fieldName] !== undefined) {
        if (fieldName === 'roleIds' && this.primaryRoleId()) {
          const restoredIds: number[] = original[fieldName] ?? [];
          const primaryId = this.primaryRoleId()!;
          this.form
            .get(fieldName)
            ?.setValue(restoredIds.includes(primaryId) ? restoredIds : [...restoredIds, primaryId]);
        } else {
          this.form.get(fieldName)?.setValue(original[fieldName]);
        }
      }
      this.updateFieldDisabledState(fieldName, true);
    } else {
      fields.add(fieldName);
      this.updateFieldDisabledState(fieldName, false);
    }
    this.editableFields.set(fields);
  }

  private updateFieldDisabledState(fieldName: string, disabled: boolean): void {
    const ctrl = this.form.get(fieldName);
    if (!ctrl) return;
    if (disabled) ctrl.disable({ emitEvent: false });
    else ctrl.enable({ emitEvent: false });
  }

  private disableAllFields(): void {
    Object.keys(this.form.controls).forEach((field) =>
      this.form.get(field)?.disable({ emitEvent: false })
    );
  }

  getFieldClass(fieldName: string): string {
    if (!this.isEdit()) return '';
    return this.isFieldEditable(fieldName) ? 'field-unlocked' : 'field-locked';
  }

  // ── Section collapse ────────────────────────────────────────────────────────
  toggleSection(key: string): void {
    const current = this.sectionExpanded();
    this.sectionExpanded.set({ ...current, [key]: !current[key] });
  }

  isSectionExpanded(key: string): boolean {
    return this.sectionExpanded()[key] ?? true;
  }

  // ── UDISE facility helpers ─────────────────────────────────────────────────
  isFacilitySelected(value: FacilityReceived): boolean {
    const facilities: string[] = this.form.get('facilitiesReceived')?.value ?? [];
    return facilities.includes(value);
  }

  toggleFacility(value: FacilityReceived): void {
    if (!this.isFieldEditable('facilitiesReceived') && this.isEdit()) return;
    const ctrl = this.form.get('facilitiesReceived');
    if (!ctrl) return;
    const current: string[] = ctrl.value ?? [];
    ctrl.setValue(
      current.includes(value) ? current.filter((f) => f !== value) : [...current, value]
    );
  }

  // ── Permission section ─────────────────────────────────────────────────────

  togglePermSection(): void {
    if (this.permSectionUnlocked()) {
      this.directGrantIds.set(new Set(this.originalGrantIds()));
      this.directDenyIds.set(new Set(this.originalDenyIds()));
      this.permissionSearch.set('');
      this.permSectionUnlocked.set(false);
    } else {
      this.permSectionUnlocked.set(true);
      if (this.allCategoryPermissions().length === 0) {
        this.loadPermissionsForUser();
      }
    }
  }

  private loadPermissionsForUser(): void {
    const primaryRole = this.primaryRoleName();
    if (!primaryRole) return;
    const category = derivePermissionCategory(primaryRole);
    this.loadingPermissions.set(true);

    let permissionsLoaded = false;
    let rolesLoaded = false;
    let grantsLoaded = false;
    let denialsLoaded = false;
    let allPerms: Permission[] = [];
    let rolePermIds = new Set<number>();
    let directGrantPermIds = new Set<number>();
    let directDenyPermIds = new Set<number>();

    const tryFinish = () => {
      if (!permissionsLoaded || !rolesLoaded || !grantsLoaded || !denialsLoaded) return;
      const grouped = allPerms.reduce((acc: Record<string, Permission[]>, p) => {
        const mod = p.module || 'Other';
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push(p);
        return acc;
      }, {});
      this.allCategoryPermissions.set(allPerms);
      this.permModuleGroups.set(
        Object.entries(grouped).map(([module, permissions]) => ({
          module,
          permissions,
          expanded: false,
        }))
      );
      this.roleInheritedPermissionIds.set(new Set(rolePermIds));
      this.directGrantIds.set(new Set(directGrantPermIds));
      this.directDenyIds.set(new Set(directDenyPermIds));
      this.originalGrantIds.set(new Set(directGrantPermIds));
      this.originalDenyIds.set(new Set(directDenyPermIds));
      this.loadingPermissions.set(false);
    };

    this.rolesService.getAllPermissions(category).subscribe({
      next: (res) => {
        allPerms = res.permissions ?? [];
        permissionsLoaded = true;
        tryFinish();
      },
      error: () => {
        this.toast.error('Failed to load permissions');
        this.loadingPermissions.set(false);
      },
    });

    const uid = this.userId();
    if (uid) {
      this.usersService.getUserRoles(uid).subscribe({
        next: (userRoles) => {
          const userRoleIds = userRoles.map((r) => r.id);
          if (userRoleIds.length === 0) {
            rolesLoaded = true;
            tryFinish();
            return;
          }
          this.rolesService.getAllRoles().subscribe({
            next: (res) => {
              const rolePermSlugs = new Set<string>();
              (res.roles ?? [])
                .filter((r) => userRoleIds.includes(r.id))
                .forEach((r) => r.permissions?.forEach((p) => rolePermSlugs.add(p.slug)));
              allPerms.forEach((p) => {
                if (rolePermSlugs.has(p.slug)) rolePermIds.add(p.id);
              });
              rolesLoaded = true;
              tryFinish();
            },
            error: () => {
              rolesLoaded = true;
              tryFinish();
            },
          });
        },
        error: () => {
          rolesLoaded = true;
          tryFinish();
        },
      });

      this.usersService.getUserDirectPermissions(uid).subscribe({
        next: (perms) => {
          perms.forEach((p) => directGrantPermIds.add(p.id));
          grantsLoaded = true;
          tryFinish();
        },
        error: () => {
          grantsLoaded = true;
          tryFinish();
        },
      });

      this.usersService.getUserDeniedPermissions(uid).subscribe({
        next: (perms) => {
          perms.forEach((p) => directDenyPermIds.add(p.id));
          denialsLoaded = true;
          tryFinish();
        },
        error: () => {
          denialsLoaded = true;
          tryFinish();
        },
      });
    } else {
      rolesLoaded = true;
      grantsLoaded = true;
      denialsLoaded = true;
      tryFinish();
    }
  }

  // ── 3-state permission helpers ─────────────────────────────────────────────

  getPermissionState(permId: number): PermissionState {
    if (this.directDenyIds().has(permId)) return 'denied';
    if (this.directGrantIds().has(permId)) return 'granted';
    if (this.roleInheritedPermissionIds().has(permId)) return 'inherited';
    return 'none';
  }

  isPermEffectivelyActive(permId: number): boolean {
    const s = this.getPermissionState(permId);
    return s === 'granted' || s === 'inherited';
  }

  isPermDenied(permId: number): boolean {
    return this.directDenyIds().has(permId);
  }
  isPermGranted(permId: number): boolean {
    return this.directGrantIds().has(permId);
  }
  isPermInherited(permId: number): boolean {
    return this.roleInheritedPermissionIds().has(permId);
  }

  togglePermission(permId: number): void {
    const grants = new Set(this.directGrantIds());
    const denials = new Set(this.directDenyIds());
    const isInherited = this.roleInheritedPermissionIds().has(permId);
    const isDenied = denials.has(permId);
    const isGranted = grants.has(permId);

    if (isInherited) {
      if (isDenied) {
        denials.delete(permId);
      } else {
        denials.add(permId);
        grants.delete(permId);
      }
    } else {
      if (isGranted) {
        grants.delete(permId);
      } else {
        grants.add(permId);
        denials.delete(permId);
      }
    }
    this.directGrantIds.set(grants);
    this.directDenyIds.set(denials);
  }

  denyInheritedPermission(permId: number, event: Event): void {
    event.stopPropagation();
    const denials = new Set(this.directDenyIds());
    const grants = new Set(this.directGrantIds());
    denials.add(permId);
    grants.delete(permId);
    this.directDenyIds.set(denials);
    this.directGrantIds.set(grants);
  }

  restoreDeniedPermission(permId: number, event: Event): void {
    event.stopPropagation();
    const denials = new Set(this.directDenyIds());
    denials.delete(permId);
    this.directDenyIds.set(denials);
  }

  isPermModuleFullyActive(group: PermModuleGroup): boolean {
    return group.permissions.every((p) => this.isPermEffectivelyActive(p.id));
  }
  isPermModulePartiallyActive(group: PermModuleGroup): boolean {
    const active = group.permissions.filter((p) => this.isPermEffectivelyActive(p.id));
    return active.length > 0 && active.length < group.permissions.length;
  }
  isPermModuleHasDenials(group: PermModuleGroup): boolean {
    return group.permissions.some((p) => this.isPermDenied(p.id));
  }
  togglePermModule(group: PermModuleGroup): void {
    group.expanded = !group.expanded;
  }

  activatePermModule(group: PermModuleGroup, event: Event): void {
    event.stopPropagation();
    const grants = new Set(this.directGrantIds());
    const denials = new Set(this.directDenyIds());
    group.permissions.forEach((p) => {
      denials.delete(p.id);
      if (!this.roleInheritedPermissionIds().has(p.id)) grants.add(p.id);
    });
    this.directGrantIds.set(grants);
    this.directDenyIds.set(denials);
  }

  denyPermModule(group: PermModuleGroup, event: Event): void {
    event.stopPropagation();
    const grants = new Set(this.directGrantIds());
    const denials = new Set(this.directDenyIds());
    group.permissions.forEach((p) => {
      if (this.roleInheritedPermissionIds().has(p.id)) {
        denials.add(p.id);
        grants.delete(p.id);
      } else {
        grants.delete(p.id);
      }
    });
    this.directGrantIds.set(grants);
    this.directDenyIds.set(denials);
  }

  savePermissions(): void {
    const uid = this.userId();
    if (!uid) return;
    const roleInherited = this.roleInheritedPermissionIds();
    const extraGrantIds = Array.from(this.directGrantIds()).filter((id) => !roleInherited.has(id));
    const denyIds = Array.from(this.directDenyIds());
    this.savingPermissions.set(true);
    this.usersService.assignDirectPermissions(uid, extraGrantIds, denyIds).subscribe({
      next: () => {
        this.toast.success('Permission overrides saved successfully');
        this.originalGrantIds.set(new Set(this.directGrantIds()));
        this.originalDenyIds.set(new Set(this.directDenyIds()));
        this.savingPermissions.set(false);
        this.permSectionUnlocked.set(false);
        this.permissionSearch.set('');
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Failed to update permissions';
        const code = err?.error?.code;
        this.toast.error(code === 'CATEGORY_MISMATCH' ? `Category mismatch: ${msg}` : msg);
        this.savingPermissions.set(false);
      },
    });
  }

  cancelPermEdit(): void {
    this.directGrantIds.set(new Set(this.originalGrantIds()));
    this.directDenyIds.set(new Set(this.originalDenyIds()));
    this.permissionSearch.set('');
    this.permSectionUnlocked.set(false);
  }

  // ── Form submission ────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid && !this.isEdit()) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted errors before submitting.');
      return;
    }
    if (this.isEdit()) {
      const changes = this.detectChanges();
      if (changes.length === 0) {
        this.toast.info('No changes detected.');
        return;
      }
      this.pendingChanges.set(changes);
      this.showConfirmDialog.set(true);
    } else {
      this.submitting.set(true);
      this.submitCreate(this.form.getRawValue());
    }
  }

  confirmAndSave(): void {
    this.showConfirmDialog.set(false);
    this.submitting.set(true);
    this.submitUpdate(this.form.getRawValue());
  }

  cancelConfirm(): void {
    this.showConfirmDialog.set(false);
  }

  private detectChanges(): FieldChange[] {
    const changes: FieldChange[] = [];
    const original = this.originalValues();
    const current = this.form.getRawValue() as Record<string, any>;

    for (const field of this.editableFields()) {
      const oldVal = original[field];
      const newVal = current[field];
      if (field === 'newPassword') {
        if (newVal?.trim()) {
          changes.push({
            label: 'Password',
            field,
            oldValue: '••••••••',
            newValue: '(new password set)',
          });
        }
        continue;
      }
      const oldStr = this.formatValueForDisplay(field, oldVal);
      const newStr = this.formatValueForDisplay(field, newVal);
      if (oldStr !== newStr) {
        changes.push({
          label: this.fieldLabels[field] || field,
          field,
          oldValue: oldStr || '(not set)',
          newValue: newStr || '(not set)',
        });
      }
    }
    return changes;
  }

  private formatValueForDisplay(field: string, value: any): string {
    if (value === null || value === undefined || value === '') return '';
    if (field === 'roleIds' && Array.isArray(value)) {
      return value
        .map((id: number) => {
          const role = this.availableRoles().find((r) => r.id === id);
          return role ? role.name.replace(/_/g, ' ') : `Role #${id}`;
        })
        .join(', ');
    }
    if (field === 'isActive') return value ? 'Active' : 'Inactive';
    if (
      [
        'isMinority',
        'isBpl',
        'isCwsn',
        'hasDisabilityCertificate',
        'isAadhaarVerified',
        'udiseVerified',
      ].includes(field)
    ) {
      return value ? 'Yes' : 'No';
    }
    if (field === 'socialCategory') return (SOCIAL_CATEGORY_LABELS as any)[value] ?? String(value);
    if (field === 'religion') return (RELIGION_LABELS as any)[value] ?? String(value);
    if (field === 'facilitiesReceived' && Array.isArray(value)) {
      return value.length === 0
        ? 'None'
        : value.map((v: string) => (FACILITY_LABELS as any)[v] ?? v).join(', ');
    }
    if (value instanceof Date) return this.datePipe.transform(value, 'dd MMM yyyy') ?? '';
    return String(value);
  }

  // ── Validators ─────────────────────────────────────────────────────────────
  private minArrayLength(min: number): ValidatorFn {
    return (ctrl: AbstractControl) => {
      const v = ctrl.value;
      return Array.isArray(v) && v.length >= min ? null : { minArrayLength: true };
    };
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private loadUser(id: number): void {
    this.loading.set(true);
    this.usersService.getUserById(id).subscribe({
      next: (user) => {
        const primaryRole = user.primaryRole ?? '';
        this.primaryRoleName.set(primaryRole);

        // Derive category and load roles filtered to that category
        const category = primaryRoleToCategory(primaryRole);
        const primaryId = user.roles.find((r) => r.name === primaryRole)?.id ?? null;
        this.primaryRoleId.set(primaryId);
        this.loadRolesForCategory(category, primaryId);

        const p = (user.profile?.data ?? {}) as any;
        const values: Record<string, any> = {
          name: user.name,
          email: user.email,
          roleIds: user.roles.map((r) => r.id),
          phone: user.phone ?? '',
          alternatePhone: user.alternatePhone ?? '',
          dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : null,
          gender: user.gender ?? '',
          bloodGroup: user.bloodGroup ?? '',
          addressLineOne: user.addressLineOne ?? '',
          addressLineTwo: user.addressLineTwo ?? '',
          city: user.city ?? '',
          state: user.state ?? '',
          postalCode: user.postalCode ?? '',
          isActive: user.isActive,
          fatherName: (user as any).fatherName ?? '',
          motherName: (user as any).motherName ?? '',
          guardianName: (user as any).guardianName ?? '',
          guardianRelation: (user as any).guardianRelation ?? '',
          admissionNumber: p.admissionNumber ?? '',
          rollNumber: p.rollNumber ?? '',
          admissionDate: p.admissionDate ? new Date(p.admissionDate) : null,
          previousSchool: p.previousSchool ?? '',
          medicalInfo: p.medicalInfo ?? '',
          enrollmentType: p.enrollmentType ?? 'REGULAR',
          previousClassResult: p.previousClassResult ?? '',
          previousSchoolUdiseCode: p.previousSchoolUdiseCode ?? '',
          pen: p.pen ?? '',
          apaarId: p.apaarId ?? '',
          stateStudentId: p.stateStudentId ?? '',
          aadhaarMasked: p.aadhaarMasked ?? '',
          aadhaarName: p.aadhaarName ?? '',
          socialCategory: p.socialCategory ?? null,
          religion: p.religion ?? null,
          isMinority: p.isMinority ?? false,
          motherTongueCode: p.motherTongueCode ?? null,
          isBpl: p.isBpl ?? false,
          localityType: p.localityType ?? '',
          isCwsn: p.isCwsn ?? false,
          disabilityType: p.disabilityType ?? null,
          hasDisabilityCertificate: p.hasDisabilityCertificate ?? false,
          udidNumber: p.udidNumber ?? '',
          facilitiesReceived: p.facilitiesReceived ?? [],
          isAadhaarVerified: p.isAadhaarVerified ?? false,
          udiseVerified: p.udiseVerified ?? false,
          qualification: p.qualification ?? '',
          experienceYears: p.experienceYears ?? null,
          specialization: p.specialization ?? '',
          occupation: p.occupation ?? '',
          department: p.department ?? '',
          salary: p.salary ?? null,
          shift: p.shift ?? '',
          joiningDate: p.joiningDate ? new Date(p.joiningDate) : null,
        };
        this.form.patchValue(values, { emitEvent: false });
        this.originalValues.set({ ...values });
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load user details');
        this.router.navigate(['/school/users']);
      },
    });
  }

  // ── Submit helpers ─────────────────────────────────────────────────────────

  private submitCreate(raw: any): void {
    const primaryRoleId: number | null = raw.primaryRoleId ?? raw.roleIds?.[0] ?? null;
    if (!primaryRoleId) {
      this.toast.error('Please select a primary role.');
      this.submitting.set(false);
      return;
    }
    const roleIds: number[] = Array.isArray(raw.roleIds) ? [...raw.roleIds] : [];
    if (!roleIds.includes(primaryRoleId)) roleIds.push(primaryRoleId);

    const payload: CreateUserPayload = {
      name: raw.name.trim(),
      email: raw.email.trim().toLowerCase(),
      password: raw.password,
      primaryRoleId,
      roleIds,
      ...this.buildOptionalFields(raw),
    };
    this.usersService.createUser(payload).subscribe({
      next: () => {
        this.toast.success('User created! A welcome email has been sent.');
        this.router.navigate(['/school/users']);
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to create user');
        this.submitting.set(false);
      },
    });
  }

  private submitUpdate(raw: any): void {
    const userId = this.userId()!;
    const editableSet = this.editableFields();
    const payload: UpdateUserPayload = {};

    if (editableSet.has('name')) payload.name = raw.name?.trim();
    if (editableSet.has('email')) payload.email = raw.email?.trim().toLowerCase();
    if (editableSet.has('isActive')) payload.isActive = raw.isActive;
    if (editableSet.has('newPassword') && raw.newPassword?.trim())
      payload.newPassword = raw.newPassword.trim();

    for (const k of ['fatherName', 'motherName', 'guardianName', 'guardianRelation']) {
      if (editableSet.has(k)) (payload as any)[k] = raw[k]?.trim() || undefined;
    }

    const optionalFields = this.buildOptionalFields(raw);
    const optKeys = [
      'phone',
      'alternatePhone',
      'gender',
      'bloodGroup',
      'addressLineOne',
      'addressLineTwo',
      'city',
      'state',
      'postalCode',
      'dateOfBirth',
      'admissionNumber',
      'rollNumber',
      'admissionDate',
      'previousSchool',
      'medicalInfo',
      'enrollmentType',
      'previousClassResult',
      'previousSchoolUdiseCode',
      'pen',
      'apaarId',
      'stateStudentId',
      'aadhaarMasked',
      'aadhaarName',
      'socialCategory',
      'religion',
      'isMinority',
      'motherTongueCode',
      'isBpl',
      'localityType',
      'isCwsn',
      'disabilityType',
      'hasDisabilityCertificate',
      'udidNumber',
      'facilitiesReceived',
      'isAadhaarVerified',
      'udiseVerified',
      'qualification',
      'experienceYears',
      'specialization',
      'occupation',
      'department',
      'salary',
      'shift',
      'joiningDate',
    ];
    for (const k of optKeys) {
      if (editableSet.has(k) && (optionalFields as any)[k] !== undefined) {
        (payload as any)[k] = (optionalFields as any)[k];
      }
    }

    const rolesChanged = editableSet.has('roleIds');
    const originalRoleIds: number[] = this.originalValues()['roleIds'] ?? [];
    const newRoleIds: number[] = raw.roleIds ?? [];
    const primaryId = this.primaryRoleId();
    if (primaryId && !newRoleIds.includes(primaryId)) newRoleIds.push(primaryId);
    const rolesDiffer =
      rolesChanged &&
      (originalRoleIds.length !== newRoleIds.length ||
        !originalRoleIds.every((id) => newRoleIds.includes(id)));

    const hasUserUpdates = Object.keys(payload).length > 0;
    const doUserUpdate$ = hasUserUpdates ? this.usersService.updateUser(userId, payload) : null;
    const doRolesUpdate$ =
      rolesDiffer && newRoleIds.length > 0
        ? this.usersService.assignRoles(userId, newRoleIds)
        : null;

    if (!doUserUpdate$ && !doRolesUpdate$) {
      this.toast.info('No changes to save.');
      this.submitting.set(false);
      return;
    }

    const afterAll = () => {
      this.toast.success('User updated successfully!');
      this.router.navigate(['/school/users']);
    };

    if (doUserUpdate$ && doRolesUpdate$) {
      doUserUpdate$.subscribe({
        next: () =>
          doRolesUpdate$.subscribe({
            next: afterAll,
            error: (err) => {
              this.handleRolesError(err);
              this.submitting.set(false);
            },
          }),
        error: (err) => {
          this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to update user');
          this.submitting.set(false);
        },
      });
    } else if (doUserUpdate$) {
      doUserUpdate$.subscribe({
        next: afterAll,
        error: (err) => {
          this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to update user');
          this.submitting.set(false);
        },
      });
    } else if (doRolesUpdate$) {
      doRolesUpdate$.subscribe({
        next: afterAll,
        error: (err) => {
          this.handleRolesError(err);
          this.submitting.set(false);
        },
      });
    }
  }

  private buildOptionalFields(raw: any) {
    const out: any = {};
    const strFields = [
      'phone',
      'alternatePhone',
      'gender',
      'bloodGroup',
      'addressLineOne',
      'addressLineTwo',
      'city',
      'state',
      'postalCode',
      'admissionNumber',
      'rollNumber',
      'previousSchool',
      'medicalInfo',
      'enrollmentType',
      'previousClassResult',
      'previousSchoolUdiseCode',
      'pen',
      'apaarId',
      'stateStudentId',
      'aadhaarMasked',
      'aadhaarName',
      'localityType',
      'udidNumber',
      'qualification',
      'specialization',
      'occupation',
      'department',
      'shift',
      'fatherName',
      'motherName',
      'guardianName',
      'guardianRelation',
    ];
    strFields.forEach((k) => {
      if (raw[k]?.toString().trim()) out[k] = raw[k].toString().trim();
    });
    if (raw.dateOfBirth) out.dateOfBirth = this.formatDate(raw.dateOfBirth);
    if (raw.admissionDate) out.admissionDate = this.formatDate(raw.admissionDate);
    if (raw.joiningDate) out.joiningDate = this.formatDate(raw.joiningDate);
    if (raw.experienceYears != null) out.experienceYears = Number(raw.experienceYears);
    if (raw.salary != null) out.salary = Number(raw.salary);
    if (raw.motherTongueCode != null) out.motherTongueCode = Number(raw.motherTongueCode);
    [
      'isMinority',
      'isBpl',
      'isCwsn',
      'hasDisabilityCertificate',
      'isAadhaarVerified',
      'udiseVerified',
    ].forEach((k) => {
      if (raw[k] !== undefined) out[k] = !!raw[k];
    });
    if (raw.socialCategory != null)
      out.socialCategory = Number(raw.socialCategory) as SocialCategory;
    if (raw.religion != null) out.religion = Number(raw.religion) as Religion;
    if (raw.disabilityType != null)
      out.disabilityType = Number(raw.disabilityType) as DisabilityType;
    if (Array.isArray(raw.facilitiesReceived)) out.facilitiesReceived = raw.facilitiesReceived;
    return out;
  }

  private formatDate(date: Date | string | null): string | undefined {
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? undefined;
  }

  // ── Navigation helpers ─────────────────────────────────────────────────────
  goBack(): void {
    this.router.navigate(['/school/users']);
  }
  getRoleDisplayName(role: RoleOption): string {
    return role.name.replace(/_/g, ' ');
  }
  hasAnyEditableField(): boolean {
    return this.editableFields().size > 0;
  }
  getEditableFieldsCount(): number {
    return this.editableFields().size;
  }

  private handleRolesError(err: any): void {
    const serverError: string = err?.error?.error ?? err?.message ?? '';
    const code: string = err?.error?.code ?? '';
    if (code === 'PRIMARY_ROLE_GUARD' || serverError.includes('primary role')) {
      this.toast.error(
        `Cannot remove the primary role "${this.primaryRoleName().replace(
          /_/g,
          ' '
        )}" — it permanently defines this user's identity.`
      );
    } else if (code === 'LAST_OWNER_GUARD' || serverError.includes('SCHOOL_OWNER')) {
      this.toast.error(
        'Cannot remove the School Owner role — at least one School Owner must always exist.'
      );
    } else {
      this.toast.error(serverError || 'Failed to update roles');
    }
  }
}
