// role-form-dialog.ts
// UPDATED: Full category enforcement.
//
// CREATE mode:
//   - Shows a 3-card category selector (Staff / Student / Parent) BEFORE
//     the permission picker loads.
//   - Permissions are loaded only after the user picks a category.
//   - The chosen category is sent as part of the create payload.
//   - Templates are filtered to match the selected category.
//
// EDIT mode:
//   - Reads category from role data (now included in getAllRoles response).
//   - Locks category — shows a read-only badge, no selector.
//   - Permissions are loaded filtered to the role's existing category.
//   - The category is NOT sent on update (immutable — backend ignores it anyway).

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  RolesService,
  Role,
  Permission,
  RoleTemplate,
  RoleCategory,
} from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';

interface DialogData {
  mode: 'create' | 'edit';
  role?: Role;
}

interface ModuleGroup {
  module: string;
  permissions: Permission[];
  expanded: boolean;
}

// ── Category metadata used for the selector cards ────────────────────────────
interface CategoryOption {
  value: RoleCategory;
  label: string;
  description: string;
  icon: string;
  colorClass: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: 'staff',
    label: 'Staff',
    description: 'Teachers, accountants, admin and all school staff',
    icon: 'manage_accounts',
    colorClass: 'cat-staff',
  },
  {
    value: 'student',
    label: 'Student',
    description: 'Students accessing their own portal and data',
    icon: 'school',
    colorClass: 'cat-student',
  },
  {
    value: 'parent',
    label: 'Parent',
    description: "Parents / guardians viewing their child's data",
    icon: 'family_restroom',
    colorClass: 'cat-parent',
  },
];

@Component({
  selector: 'app-role-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './role-form-dialog.html',
  styleUrl: './role-form-dialog.scss',
})
export class RoleFormDialog implements OnInit {
  private fb = inject(FormBuilder);
  private rolesService = inject(RolesService);
  private toast = inject(ToastService);
  private dialogRef = inject(MatDialogRef<RoleFormDialog>);
  data = inject(MAT_DIALOG_DATA) as DialogData;

  form!: FormGroup;
  saving = signal(false);
  loadingPermissions = signal(false);

  allPermissions = signal<Permission[]>([]);
  moduleGroups = signal<ModuleGroup[]>([]);
  selectedPermissionIds = signal<Set<number>>(new Set());

  templates = signal<RoleTemplate[]>([]);
  filteredTemplates = signal<RoleTemplate[]>([]);
  selectedTemplateId = signal<string | null>(null);

  permissionSearch = signal('');

  // ── Category state ─────────────────────────────────────────────────────────
  // In create mode: user selects a category via the selector cards.
  // In edit mode: locked to the role's existing category.
  selectedCategory = signal<RoleCategory | null>(null);
  readonly categoryOptions = CATEGORY_OPTIONS;

  filteredGroups = computed(() => {
    const q = this.permissionSearch().toLowerCase().trim();
    if (!q) return this.moduleGroups();
    return this.moduleGroups()
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) => p.slug.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
        ),
        expanded: true,
      }))
      .filter((g) => g.permissions.length > 0);
  });

  selectedCount = computed(() => this.selectedPermissionIds().size);
  totalCount = computed(() => this.allPermissions().length);

  // True once a category has been chosen and permissions have been loaded
  permissionsReady = computed(() => this.selectedCategory() !== null && !this.loadingPermissions());

  get isEdit(): boolean {
    return this.data.mode === 'edit';
  }

  /** Human-readable label for the locked category in edit mode */
  get lockedCategoryOption(): CategoryOption | undefined {
    return CATEGORY_OPTIONS.find((c) => c.value === this.selectedCategory());
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [
        this.data.role?.name ?? '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
      ],
      description: [
        this.data.role?.description ?? '',
        [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
      ],
    });

    if (this.isEdit) {
      // ── Edit mode: lock category and load permissions immediately ──────────
      const roleCategory = this.data.role?.category ?? 'staff';
      this.selectedCategory.set(roleCategory);

      // Pre-select the role's current permissions
      if (this.data.role?.permissions) {
        const ids = new Set(this.data.role.permissions.map((p) => p.id));
        this.selectedPermissionIds.set(ids);
      }

      // Load permissions filtered to the role's category
      this.loadPermissions(roleCategory);
    } else {
      // ── Create mode: wait for user to pick a category ─────────────────────
      // Permissions are NOT loaded until selectCategory() is called.
      this.loadTemplates();
    }
  }

  // ── Category selection (create mode only) ─────────────────────────────────

  selectCategory(category: RoleCategory): void {
    if (this.isEdit) return; // locked in edit mode

    const previous = this.selectedCategory();

    // If switching category, clear previously selected permissions and template
    if (previous !== null && previous !== category) {
      this.selectedPermissionIds.set(new Set());
      this.selectedTemplateId.set(null);
      this.allPermissions.set([]);
      this.moduleGroups.set([]);
    }

    this.selectedCategory.set(category);
    this.updateFilteredTemplates(category);
    this.loadPermissions(category);
  }

  private updateFilteredTemplates(category: RoleCategory): void {
    const all = this.templates();
    this.filteredTemplates.set(all.filter((t) => t.category === category));
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  loadPermissions(category: RoleCategory): void {
    this.loadingPermissions.set(true);

    this.rolesService.getAllPermissions(category).subscribe({
      next: (res) => {
        this.allPermissions.set(res.permissions ?? []);

        const grouped = (res.permissions ?? []).reduce((acc: Record<string, Permission[]>, p) => {
          const mod = p.module || 'Other';
          if (!acc[mod]) acc[mod] = [];
          acc[mod].push(p);
          return acc;
        }, {});

        this.moduleGroups.set(
          Object.entries(grouped).map(([module, permissions]) => ({
            module,
            permissions,
            // In edit mode, expand all groups so current permissions are visible
            expanded: this.isEdit,
          }))
        );

        this.loadingPermissions.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to load permissions';
        this.toast.error(msg);
        this.loadingPermissions.set(false);
      },
    });
  }

  loadTemplates(): void {
    this.rolesService.getRoleTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.templates ?? []);
        // If a category is already selected, filter immediately
        const cat = this.selectedCategory();
        if (cat) this.updateFilteredTemplates(cat);
      },
      error: () => {},
    });
  }

  // ── Module group helpers ───────────────────────────────────────────────────

  toggleModule(group: ModuleGroup): void {
    group.expanded = !group.expanded;
  }

  isModuleFullySelected(group: ModuleGroup): boolean {
    return group.permissions.every((p) => this.selectedPermissionIds().has(p.id));
  }

  isModulePartiallySelected(group: ModuleGroup): boolean {
    const selected = group.permissions.filter((p) => this.selectedPermissionIds().has(p.id));
    return selected.length > 0 && selected.length < group.permissions.length;
  }

  toggleModulePermissions(group: ModuleGroup): void {
    const ids = new Set(this.selectedPermissionIds());
    const allSelected = this.isModuleFullySelected(group);
    group.permissions.forEach((p) => {
      if (allSelected) ids.delete(p.id);
      else ids.add(p.id);
    });
    this.selectedPermissionIds.set(ids);
  }

  togglePermission(permId: number): void {
    const ids = new Set(this.selectedPermissionIds());
    if (ids.has(permId)) ids.delete(permId);
    else ids.add(permId);
    this.selectedPermissionIds.set(ids);
  }

  isSelected(permId: number): boolean {
    return this.selectedPermissionIds().has(permId);
  }

  applyTemplate(template: RoleTemplate): void {
    if (this.selectedTemplateId() === template.id) {
      this.selectedTemplateId.set(null);
      this.selectedPermissionIds.set(new Set());
      return;
    }
    this.selectedTemplateId.set(template.id);
    const slugSet = new Set(template.permissionSlugs);
    const ids = new Set(
      this.allPermissions()
        .filter((p) => slugSet.has(p.slug))
        .map((p) => p.id)
    );
    this.selectedPermissionIds.set(ids);
  }

  selectAll(): void {
    const ids = new Set(this.allPermissions().map((p) => p.id));
    this.selectedPermissionIds.set(ids);
  }

  clearAll(): void {
    this.selectedPermissionIds.set(new Set());
    this.selectedTemplateId.set(null);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Guard: category must be set (always true in edit, must be chosen in create)
    if (!this.selectedCategory()) {
      this.toast.error('Please select a role type (Staff, Student, or Parent)');
      return;
    }

    const permIds = Array.from(this.selectedPermissionIds());
    if (permIds.length === 0) {
      this.toast.error('Please select at least one permission');
      return;
    }

    this.saving.set(true);
    const { name, description } = this.form.value;

    if (this.isEdit) {
      // UPDATE: category not sent — immutable
      this.rolesService
        .updateRole(this.data.role!.id, {
          name,
          description,
          permissionIds: permIds,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.dialogRef.close(true);
          },
          error: (err) => {
            const msg = err?.error?.error ?? err?.message ?? 'Failed to update role';
            this.toast.error(msg);
            this.saving.set(false);
          },
        });
    } else {
      // CREATE: category is required
      this.rolesService
        .createRole({
          name,
          description,
          permissionIds: permIds,
          category: this.selectedCategory()!,
          templateId: this.selectedTemplateId() ?? undefined,
        })
        .subscribe({
          next: (res) => {
            this.saving.set(false);
            this.dialogRef.close(res.role);
          },
          error: (err) => {
            const msg = err?.error?.error ?? err?.message ?? 'Failed to create role';
            this.toast.error(msg);
            this.saving.set(false);
          },
        });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
