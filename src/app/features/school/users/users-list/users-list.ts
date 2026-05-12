// users-list/users-list.ts

import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import {
  DeletionCheckResult,
  SchoolUser,
  UserCategory,
  UsersService,
} from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

// ── Tab Definition ─────────────────────────────────────────────────────────────
export interface UserTab {
  id: UserCategory;
  label: string;
  icon: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export class UsersList {
  private usersService = inject(UsersService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // ── Permission flags ───────────────────────────────────────────────────────
  canCreate = computed(() => this.auth.hasPermission('users.create'));
  canEdit = computed(() => this.auth.hasPermission('users.edit'));
  canDelete = computed(() => this.auth.hasPermission('users.delete'));
  currentUserId = computed(() => this.auth.schoolUser()?.id);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  readonly tabs: UserTab[] = [
    {
      id: 'staff',
      label: 'Staff',
      icon: 'badge',
      description: 'Teachers, principals, admin & operations staff',
      color: 'staff',
    },
    {
      id: 'student',
      label: 'Students',
      icon: 'school',
      description: 'Enrolled and former students',
      color: 'student',
    },
    {
      id: 'parent',
      label: 'Parents',
      icon: 'family_restroom',
      description: 'Student parents and guardians',
      color: 'parent',
    },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  activeTab = signal<UserCategory>('staff');
  dataSource = new MatTableDataSource<SchoolUser>([]);
  loading = signal(false);
  loadingDelete = signal(false);
  error = signal<string | null>(null);

  // Per-tab data cache — populated on first load/refresh, cleared on tab switch
  // to avoid showing stale cross-tab data.
  private tabCache = new Map<UserCategory, SchoolUser[]>();

  // Track which tabs have been loaded (avoid re-fetching unless refresh clicked)
  // private loadedTabs = new Set<UserCategory>();

  // ── Deletion dialog state ──────────────────────────────────────────────────
  showDeleteDialog = signal(false);
  showDeactivateDialog = signal(false);
  deletionCheckResult = signal<DeletionCheckResult | null>(null);
  deletionCheckLoading = signal(false);
  pendingActionUser = signal<SchoolUser | null>(null);

  displayedColumns = ['user', 'roles', 'phone', 'status', 'actions'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ── Tab switching ──────────────────────────────────────────────────────────
  switchTab(tab: UserCategory): void {
    if (this.activeTab() === tab) return;
  
    this.activeTab.set(tab);
    this.error.set(null);
    this.clearFilter();
  
    // Immediately restore this tab's cached data (empty array if not yet loaded).
    // This is the critical fix: we ALWAYS update dataSource on tab switch so
    // the previous tab's rows never bleed into the new tab's view.
    const cached = this.tabCache.get(tab) ?? [];
    this.dataSource.data = cached;
  
    // Re-attach paginator/sort after data change
    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  // ── Load users for active tab ──────────────────────────────────────────────
  loadCurrentTab(): void {
    const tab = this.activeTab();
    this.loading.set(true);
    this.error.set(null);
  
    this.usersService.getUsersByCategory(tab).subscribe({
      next: (users) => {
        // Store in per-tab cache
        this.tabCache.set(tab, users);
  
        // Only apply to dataSource if this tab is still active
        // (guards against a slow response arriving after the user switched away)
        if (this.activeTab() === tab) {
          this.dataSource.data = users;
          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;
          });
        }
  
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load users');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  isTabLoaded(): boolean {
    return this.tabCache.has(this.activeTab());
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dataSource.filter = value.trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  clearFilter(): void {
    this.dataSource.filter = '';
  }

  get activeTabInfo(): UserTab {
    return this.tabs.find((t) => t.id === this.activeTab())!;
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  createUser(): void {
    this.router.navigate(['/school/users/create']);
  }

  editUser(user: SchoolUser): void {
    this.router.navigate(['/school/users/edit', user.id]);
  }

  // ── Deactivate dialog ──────────────────────────────────────────────────────
  openDeactivateDialog(user: SchoolUser): void {
    this.pendingActionUser.set(user);
    this.showDeactivateDialog.set(true);
  }

  closeDeactivateDialog(): void {
    this.showDeactivateDialog.set(false);
    this.pendingActionUser.set(null);
  }

  confirmToggleStatus(): void {
    const user = this.pendingActionUser();
    if (!user) return;

    const newStatus = !user.isActive;
    this.usersService.toggleUserActive(user.id, newStatus).subscribe({
      next: () => {
        this.dataSource.data = this.dataSource.data.map((u) =>
          u.id === user.id ? { ...u, isActive: newStatus } : u
        );
        this.toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
        this.closeDeactivateDialog();
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to update status');
        this.closeDeactivateDialog();
      },
    });
  }

  // ── Delete dialog ──────────────────────────────────────────────────────────
  openDeleteDialog(user: SchoolUser): void {
    if (user.id === this.currentUserId()) {
      this.toast.error('You cannot delete your own account.');
      return;
    }

    this.pendingActionUser.set(user);
    this.deletionCheckResult.set(null);
    this.showDeleteDialog.set(true);
    this.deletionCheckLoading.set(true);

    // Fetch impact analysis from backend
    this.usersService.checkDeletionImpact(user.id).subscribe({
      next: (result) => {
        this.deletionCheckResult.set(result);
        this.deletionCheckLoading.set(false);
      },
      error: (err) => {
        this.toast.error('Could not fetch deletion impact. Please try again.');
        this.deletionCheckLoading.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
    this.pendingActionUser.set(null);
    this.deletionCheckResult.set(null);
  }

  confirmDelete(): void {
    const user = this.pendingActionUser();
    const result = this.deletionCheckResult();
    if (!user || !result?.canDelete) return;

    this.loadingDelete.set(true);
    this.usersService.deleteUser(user.id).subscribe({
      next: () => {
        this.dataSource.data = this.dataSource.data.filter((u) => u.id !== user.id);
        this.toast.success('User deleted successfully');
        this.loadingDelete.set(false);
        this.closeDeleteDialog();
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? err?.message ?? 'Failed to delete user');
        this.loadingDelete.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  // ── Display helpers ────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getRoleBadgeClass(roleName: string): string {
    return roleName.toLowerCase().replace(/_/g, '_');
  }

  getPrimaryRoleName(user: SchoolUser): string {
    if (user.primaryRole) return user.primaryRole.replace(/_/g, ' ');
    if (!user.roles || user.roles.length === 0) return 'No Role';
    return user.roles[0].name.replace(/_/g, ' ');
  }

  getWarningSeverityIcon(severity: 'info' | 'warning' | 'danger'): string {
    switch (severity) {
      case 'danger':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
    }
  }

  getExtraRolesTooltip(user: SchoolUser): string {
    return user.roles
      .slice(2)
      .map((r) => r.name.replace(/_/g, ' '))
      .join(', ');
  }

  hasSummaryData(result: DeletionCheckResult): boolean {
    const s = result.summary;
    return (
      s.enrollments > 0 ||
      s.attendanceRecords > 0 ||
      s.feePayments > 0 ||
      s.examMarks > 0 ||
      s.assignments > 0 ||
      s.submissions > 0 ||
      s.linkedChildren > 0 ||
      s.linkedParents > 0
    );
  }
}
