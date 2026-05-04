// roles.ts
// UPDATED: Role cards now show a category badge (Staff / Student / Parent).
// filteredRoles can optionally be filtered by category via a new 'category' filter tab.
// Role interface now includes `category` (from updated RolesService).

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { Role, RoleCategory, RolesService } from '../../../../core/services/roles.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { RoleFormDialog } from '../role-form-dialog/role-form-dialog';
import { RoleDetailDialog } from '../role-detail-dialog/role-detail-dialog';
import { RoleCloneDialog } from '../role-clone-dialog/role-clone-dialog';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

// ── Filter type now includes category filtering ───────────────────────────────
type RoleTypeFilter = 'all' | 'system' | 'custom';
type RoleCategoryFilter = 'all' | 'staff' | 'student' | 'parent';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
  ],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles implements OnInit {
  private rolesService = inject(RolesService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);

  roles = signal<Role[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');
  filterType = signal<RoleTypeFilter>('all');
  filterCategory = signal<RoleCategoryFilter>('all');

  canManage = computed(() => this.auth.hasPermission('roles.manage'));

  totalRoles = computed(() => this.roles().length);
  systemRoles = computed(() => this.roles().filter((r) => r.isSystem).length);
  customRoles = computed(() => this.roles().filter((r) => !r.isSystem).length);

  // Stats by category
  staffRolesCount = computed(() => this.roles().filter((r) => r.category === 'staff').length);
  studentRolesCount = computed(() => this.roles().filter((r) => r.category === 'student').length);
  parentRolesCount = computed(() => this.roles().filter((r) => r.category === 'parent').length);

  filteredRoles = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const type = this.filterType();
    const cat = this.filterCategory();

    return this.roles().filter((role) => {
      const matchesSearch =
        !q || role.name.toLowerCase().includes(q) || role.description.toLowerCase().includes(q);
      const matchesType =
        type === 'all' ||
        (type === 'system' && role.isSystem) ||
        (type === 'custom' && !role.isSystem);
      const matchesCategory = cat === 'all' || role.category === cat;
      return matchesSearch && matchesType && matchesCategory;
    });
  });

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.error.set(null);

    this.rolesService.getAllRoles().subscribe({
      next: (res) => {
        this.roles.set(res.roles ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Failed to load roles';
        this.error.set(msg);
        this.toast.error(msg);
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(RoleFormDialog, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'role-dialog-panel',
      data: { mode: 'create' },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.roles.update((roles) => [...roles, result]);
        this.toast.success(`Role "${result.name}" created successfully`);
      }
    });
  }

  openEditDialog(role: Role): void {
    const ref = this.dialog.open(RoleFormDialog, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'role-dialog-panel',
      data: { mode: 'edit', role },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.loadRoles();
        this.toast.success('Role updated successfully');
      }
    });
  }

  openDetailDialog(role: Role): void {
    this.dialog.open(RoleDetailDialog, {
      width: '660px',
      maxWidth: '96vw',
      maxHeight: '88vh',
      panelClass: 'role-dialog-panel',
      data: { role },
    });
  }

  openCloneDialog(role: Role): void {
    const ref = this.dialog.open(RoleCloneDialog, {
      width: '500px',
      maxWidth: '96vw',
      panelClass: 'role-dialog-panel',
      data: { role },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.roles.update((roles) => [...roles, result]);
        this.toast.success(`Role "${result.name}" cloned successfully`);
      }
    });
  }

  deleteRole(role: Role): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Delete Role',
        message: `Are you sure you want to delete "${role.name}"? Users with this role will lose access. This cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.rolesService.deleteRole(role.id).subscribe({
        next: () => {
          this.roles.update((roles) => roles.filter((r) => r.id !== role.id));
          this.toast.success(`Role "${role.name}" deleted`);
        },
        error: (err) => {
          const msg = err?.error?.error ?? err?.message ?? 'Failed to delete role';
          this.toast.error(msg);
        },
      });
    });
  }

  setFilter(type: RoleTypeFilter): void {
    this.filterType.set(type);
  }

  setCategoryFilter(cat: RoleCategoryFilter): void {
    this.filterCategory.set(cat);
  }

  getVisiblePermissions(role: Role): string[] {
    return role.permissions?.slice(0, 5).map((p) => p.slug) ?? [];
  }

  getExtraPermissionCount(role: Role): number {
    return Math.max(0, (role.permissions?.length ?? 0) - 5);
  }

  /** Returns a CSS class modifier for the category badge. */
  getCategoryClass(category: RoleCategory): string {
    switch (category) {
      case 'staff':
        return 'cat-staff';
      case 'student':
        return 'cat-student';
      case 'parent':
        return 'cat-parent';
      default:
        return 'cat-staff';
    }
  }

  /** Returns a mat-icon name for the category. */
  getCategoryIcon(category: RoleCategory): string {
    switch (category) {
      case 'staff':
        return 'manage_accounts';
      case 'student':
        return 'school';
      case 'parent':
        return 'family_restroom';
      default:
        return 'manage_accounts';
    }
  }

  trackById(_: number, item: Role): number {
    return item.id;
  }
}
