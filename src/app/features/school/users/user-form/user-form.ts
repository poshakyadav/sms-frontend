// user-form/user-form.ts
// UPDATED: Added "Direct Permission Overrides" section in edit mode.
// The section loads permissions filtered to the user's primaryRole category,
// shows current direct permissions, and saves via PUT /school/users/:id/permissions.
// Category is derived from primaryRole → getProfileCategory() on the backend;
// the frontend uses the same mapping to filter the permission picker.

import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { ApiService } from '../../../../core/services/api.service';
import {
  CreateUserPayload,
  SchoolUser,
  UpdateUserPayload,
  UsersService,
  UserPermission,
} from '../../../../core/services/users.service';
import { ToastService } from '../../../../core/services/toast.service';
import { RolesService, RoleCategory, Permission } from '../../../../core/services/roles.service';

// ── Indian date format provider ─────────────────────────────────────────
import { INDIAN_DATE_PROVIDERS } from '../../../../core/adapters/indian-date-adapter';

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

// ── Permission picker module group ────────────────────────────────────────────
interface PermModuleGroup {
  module: string;
  permissions: Permission[];
  expanded: boolean;
}

/**
 * Maps a primaryRole name to the permission category used by the permissions API.
 * Mirrors the backend's profileCategoryToPermissionCategory() logic.
 */
function derivePermissionCategory(primaryRole: string): RoleCategory {
  const upper = primaryRole.toUpperCase().trim();
  if (upper === 'STUDENT') return 'student';
  if (upper === 'STUDENT_PARENT') return 'parent';
  return 'staff'; // all other roles (teachers, owners, staff, etc.)
}

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
  ],
  providers: [DatePipe, ...INDIAN_DATE_PROVIDERS],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnInit {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private usersService = inject(UsersService);
  private rolesService = inject(RolesService);
  private toast = inject(ToastService);
  private datePipe = inject(DatePipe);

  // ── State ──────────────────────────────────────────────────────────────────
  isEdit = signal(false);
  userId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);
  availableRoles = signal<RoleOption[]>([]);

  primaryRoleName = signal<string>('');
  primaryRoleId = signal<number | null>(null);

  editableFields = signal<Set<string>>(new Set());

  showConfirmDialog = signal(false);
  pendingChanges = signal<FieldChange[]>([]);
  originalValues = signal<Record<string, any>>({});

  // ── Direct Permission Overrides state (edit mode only) ─────────────────────
  // The section is unlocked/locked via a dedicated toggle, same pattern as fields.
  permSectionUnlocked = signal(false);
  loadingPermissions = signal(false);
  savingPermissions = signal(false);

  // All permissions in the user's category universe
  allCategoryPermissions = signal<Permission[]>([]);
  permModuleGroups = signal<PermModuleGroup[]>([]);

  // IDs currently selected in the picker (pre-loaded from user's direct permissions)
  selectedPermissionIds = signal<Set<number>>(new Set());

  // Original direct permission IDs (to detect changes)
  originalPermissionIds = signal<Set<number>>(new Set());

  permissionSearch = signal('');

  // Computed filtered groups for permission search
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

  selectedPermCount = computed(() => this.selectedPermissionIds().size);
  totalPermCount = computed(() => this.allCategoryPermissions().length);

  // ── Static options ─────────────────────────────────────────────────────────
  bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  genders = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
  ];
  shifts = [
    { value: 'MORNING', label: 'Morning' },
    { value: 'AFTERNOON', label: 'Afternoon' },
    { value: 'EVENING', label: 'Evening' },
  ];

  private readonly fieldLabels: Record<string, string> = {
    name: 'Full Name',
    email: 'Email Address',
    password: 'Password',
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
    rollNumber: 'Roll Number',
    admissionDate: 'Admission Date',
    previousSchool: 'Previous School',
    medicalInfo: 'Medical Information',
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

  // ── Form ───────────────────────────────────────────────────────────────────
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
    rollNumber: [''],
    admissionDate: [null as Date | null],
    previousSchool: [''],
    medicalInfo: [''],
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

  // ── Computed profile flags ─────────────────────────────────────────────────
  selectedRoleNames = computed(() => {
    const roleIds: number[] = this.form?.get('roleIds')?.value ?? [];
    return this.availableRoles()
      .filter((r) => roleIds.includes(r.id))
      .map((r) => r.name.toUpperCase());
  });

  showStudentFields = computed(() => {
    if (this.isEdit()) {
      return (
        this.primaryRoleName().toUpperCase().includes('STUDENT') &&
        !this.primaryRoleName().toUpperCase().includes('PARENT')
      );
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

  /** Human-readable category label for the permission section header */
  permCategoryLabel = computed(() => {
    const cat = derivePermissionCategory(this.primaryRoleName());
    const labels: Record<RoleCategory, string> = {
      staff: 'Staff',
      student: 'Student',
      parent: 'Parent',
    };
    return labels[cat];
  });

  ngOnInit(): void {
    this.loadRoles();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.userId.set(+id);
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
      this.disableAllFields();
      this.loadUser(+id);
    } else {
      this.form.get('primaryRoleId')?.setValidators([Validators.required]);
      this.form.get('primaryRoleId')?.updateValueAndValidity();
    }

    this.form.get('primaryRoleId')?.valueChanges.subscribe((primaryId) => {
      if (this.isEdit() || !primaryId) return;
      const currentRoleIds: number[] = this.form.get('roleIds')?.value ?? [];
      if (!currentRoleIds.includes(primaryId)) {
        this.form.get('roleIds')?.setValue([...currentRoleIds, primaryId]);
      }
    });
  }

  // ── Field lock/unlock helpers ──────────────────────────────────────────────

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
          if (!restoredIds.includes(primaryId)) {
            this.form.get(fieldName)?.setValue([...restoredIds, primaryId]);
          } else {
            this.form.get(fieldName)?.setValue(restoredIds);
          }
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

  enableFieldEdit(fieldName: string, event?: Event): void {
    event?.stopPropagation();
    const fields = new Set(this.editableFields());
    fields.add(fieldName);
    this.editableFields.set(fields);
    this.updateFieldDisabledState(fieldName, false);
    setTimeout(() => {
      const el = document.querySelector(
        `[data-field="${fieldName}"] input, [data-field="${fieldName}"] textarea, [data-field="${fieldName}"] mat-select`
      ) as HTMLElement;
      el?.click();
    }, 50);
  }

  private updateFieldDisabledState(fieldName: string, disabled: boolean): void {
    const ctrl = this.form.get(fieldName);
    if (!ctrl) return;
    if (disabled) ctrl.disable({ emitEvent: false });
    else ctrl.enable({ emitEvent: false });
  }

  private disableAllFields(): void {
    Object.keys(this.form.controls).forEach((field) => {
      this.form.get(field)?.disable({ emitEvent: false });
    });
  }

  getFieldClass(fieldName: string): string {
    if (!this.isEdit()) return '';
    return this.isFieldEditable(fieldName) ? 'field-unlocked' : 'field-locked';
  }

  // ── Permission section unlock/lock ─────────────────────────────────────────

  togglePermSection(): void {
    if (this.permSectionUnlocked()) {
      // Re-lock: restore original selection
      this.selectedPermissionIds.set(new Set(this.originalPermissionIds()));
      this.permissionSearch.set('');
      this.permSectionUnlocked.set(false);
    } else {
      // Unlock: load permissions if not yet loaded
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

    // Load category-scoped permissions and current direct permissions in parallel
    let permissionsLoaded = false;
    let directLoaded = false;
    let allPerms: Permission[] = [];
    let directPermIds: number[] = [];

    const tryFinish = () => {
      if (!permissionsLoaded || !directLoaded) return;

      // Build module groups
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

      const directSet = new Set(directPermIds);
      this.selectedPermissionIds.set(directSet);
      this.originalPermissionIds.set(new Set(directSet));
      this.loadingPermissions.set(false);
    };

    // 1. Load all permissions in this category
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

    // 2. Load user's current direct permissions
    const uid = this.userId();
    if (uid) {
      this.usersService.getUserDirectPermissions(uid).subscribe({
        next: (perms) => {
          directPermIds = perms.map((p) => p.id);
          directLoaded = true;
          tryFinish();
        },
        error: () => {
          directLoaded = true; // soft fail — proceed with empty
          tryFinish();
        },
      });
    } else {
      directLoaded = true;
      tryFinish();
    }
  }

  // ── Permission picker helpers ───────────────────────────────────────────────

  isPermModuleFullySelected(group: PermModuleGroup): boolean {
    return group.permissions.every((p) => this.selectedPermissionIds().has(p.id));
  }

  isPermModulePartiallySelected(group: PermModuleGroup): boolean {
    const sel = group.permissions.filter((p) => this.selectedPermissionIds().has(p.id));
    return sel.length > 0 && sel.length < group.permissions.length;
  }

  togglePermModule(group: PermModuleGroup): void {
    group.expanded = !group.expanded;
  }

  togglePermModulePermissions(group: PermModuleGroup): void {
    const ids = new Set(this.selectedPermissionIds());
    const allSel = this.isPermModuleFullySelected(group);
    group.permissions.forEach((p) => {
      if (allSel) ids.delete(p.id);
      else ids.add(p.id);
    });
    this.selectedPermissionIds.set(ids);
  }

  toggleSinglePermission(permId: number): void {
    const ids = new Set(this.selectedPermissionIds());
    if (ids.has(permId)) ids.delete(permId);
    else ids.add(permId);
    this.selectedPermissionIds.set(ids);
  }

  isPermSelected(permId: number): boolean {
    return this.selectedPermissionIds().has(permId);
  }

  selectAllPerms(): void {
    const ids = new Set(this.allCategoryPermissions().map((p) => p.id));
    this.selectedPermissionIds.set(ids);
  }

  clearAllPerms(): void {
    this.selectedPermissionIds.set(new Set());
  }

  savePermissions(): void {
    const uid = this.userId();
    if (!uid) return;

    const permIds = Array.from(this.selectedPermissionIds());
    this.savingPermissions.set(true);

    this.usersService.assignDirectPermissions(uid, permIds).subscribe({
      next: () => {
        this.toast.success('Direct permissions updated successfully');
        this.originalPermissionIds.set(new Set(this.selectedPermissionIds()));
        this.savingPermissions.set(false);
        this.permSectionUnlocked.set(false);
        this.permissionSearch.set('');
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Failed to update permissions';
        const code = err?.error?.code;
        if (code === 'CATEGORY_MISMATCH') {
          this.toast.error(`Category mismatch: ${msg}`);
        } else {
          this.toast.error(msg);
        }
        this.savingPermissions.set(false);
      },
    });
  }

  cancelPermEdit(): void {
    this.selectedPermissionIds.set(new Set(this.originalPermissionIds()));
    this.permissionSearch.set('');
    this.permSectionUnlocked.set(false);
  }

  hasPermissionChanges = computed(() => {
    const sel = this.selectedPermissionIds();
    const orig = this.originalPermissionIds();
    if (sel.size !== orig.size) return true;
    for (const id of sel) {
      if (!orig.has(id)) return true;
    }
    return false;
  });

  // ── Confirmation dialog ────────────────────────────────────────────────────

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
      const raw = this.form.getRawValue();
      this.submitting.set(true);
      this.submitCreate(raw);
    }
  }

  confirmAndSave(): void {
    this.showConfirmDialog.set(false);
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    this.submitUpdate(raw);
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
        if (newVal && newVal.trim()) {
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
    if (value instanceof Date) return this.datePipe.transform(value, 'dd MMM yyyy') ?? '';
    return String(value);
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private minArrayLength(min: number): ValidatorFn {
    return (ctrl: AbstractControl) => {
      const v = ctrl.value;
      return Array.isArray(v) && v.length >= min ? null : { minArrayLength: true };
    };
  }

  private loadRoles(): void {
    this.api.get<{ success: boolean; roles: RoleOption[] }>('school/roles').subscribe({
      next: (res) => {
        this.availableRoles.set(res.roles ?? []);
        const name = this.primaryRoleName();
        if (name) {
          const found = (res.roles ?? []).find((r) => r.name === name);
          if (found) this.primaryRoleId.set(found.id);
        }
      },
      error: () => this.toast.error('Could not load roles list'),
    });
  }

  private loadUser(id: number): void {
    this.loading.set(true);
    this.usersService.getUserById(id).subscribe({
      next: (user) => {
        this.primaryRoleName.set(user.primaryRole ?? '');
        this.resolvePrimaryRoleId(user.primaryRole);

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
          rollNumber: p.rollNumber ?? '',
          previousSchool: p.previousSchool ?? '',
          medicalInfo: p.medicalInfo ?? '',
          qualification: p.qualification ?? '',
          experienceYears: p.experienceYears ?? null,
          specialization: p.specialization ?? '',
          occupation: p.occupation ?? '',
          department: p.department ?? '',
          salary: p.salary ?? null,
          shift: p.shift ?? '',
          admissionDate: p.admissionDate ? new Date(p.admissionDate) : null,
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

  private resolvePrimaryRoleId(primaryRoleName: string): void {
    const found = this.availableRoles().find((r) => r.name === primaryRoleName);
    if (found) this.primaryRoleId.set(found.id);
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
      roleIds: raw.roleIds,
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
    if (editableSet.has('newPassword') && raw.newPassword?.trim()) {
      payload.newPassword = raw.newPassword.trim();
    }

    const optionalFields = this.buildOptionalFields(raw);
    const optionalFieldKeys = [
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
      'rollNumber',
      'admissionDate',
      'previousSchool',
      'medicalInfo',
      'qualification',
      'experienceYears',
      'specialization',
      'occupation',
      'department',
      'salary',
      'shift',
      'joiningDate',
    ];
    for (const k of optionalFieldKeys) {
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
        next: () => {
          doRolesUpdate$.subscribe({
            next: afterAll,
            error: (err) => {
              this.handleRolesError(err);
              this.submitting.set(false);
            },
          });
        },
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
      'rollNumber',
      'previousSchool',
      'medicalInfo',
      'qualification',
      'specialization',
      'occupation',
      'department',
      'shift',
    ];
    strFields.forEach((k) => {
      if (raw[k]?.toString().trim()) out[k] = raw[k].toString().trim();
    });
    if (raw.dateOfBirth) out.dateOfBirth = this.formatDate(raw.dateOfBirth);
    if (raw.admissionDate) out.admissionDate = this.formatDate(raw.admissionDate);
    if (raw.joiningDate) out.joiningDate = this.formatDate(raw.joiningDate);
    if (raw.experienceYears !== null && raw.experienceYears !== undefined)
      out.experienceYears = Number(raw.experienceYears);
    if (raw.salary !== null && raw.salary !== undefined) out.salary = Number(raw.salary);
    return out;
  }

  private formatDate(date: Date | string | null): string | undefined {
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? undefined;
  }

  goBack(): void {
    this.router.navigate(['/school/users']);
  }

  getRoleDisplayName(role: RoleOption): string {
    return role.name.replace(/_/g, ' ');
  }

  getSelectedRoleNames(): string {
    const ids: number[] = this.form.getRawValue().roleIds ?? [];
    if (!ids.length) return 'No roles assigned';
    return ids
      .map((id) => {
        const r = this.availableRoles().find((r) => r.id === id);
        return r ? r.name.replace(/_/g, ' ') : '';
      })
      .filter(Boolean)
      .join(', ');
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
        `Cannot remove the primary role "${this.primaryRoleName().replace(/_/g, ' ')}" — ` +
          `it permanently defines this user's identity.`
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
