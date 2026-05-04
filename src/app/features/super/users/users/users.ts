import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HasSuperPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

export interface SuperUserRole {
  id: number;
  name: string;
  isSystem: boolean;
}

export interface SuperUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  tokenVersion: number;
  createdAt: string;
  roles: SuperUserRole[];
  isDeletable?: boolean;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    HasSuperPermissionDirective,
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  // ── Injected services ──────────────────────────────────────────────────────
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  public auth = inject(AuthService);

  // ── State signals ──────────────────────────────────────────────────────────
  /** Raw user list — drives the template directly via signal binding */
  users = signal<SuperUser[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  /** Derived count for the header badge */
  userCount = computed(() => this.users().length);
  hasUsers = computed(() => this.users().length > 0);

  // ── Table columns ──────────────────────────────────────────────────────────
  readonly displayedColumns = ['user', 'roles', 'status', 'created', 'actions'];

  ngOnInit(): void {
    this.fetchUsers();
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  fetchUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<{ success: boolean; users: SuperUser[] }>('users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.users.set(res.users ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err?.error?.error ?? err?.message ?? 'Failed to load users';
          this.error.set(msg);
          this.toast.error(msg);
          this.loading.set(false);
        },
      });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  navigateCreate(): void {
    this.router.navigate(['/super/users/create']);
  }

  navigateEdit(user: SuperUser): void {
    this.router.navigate(['/super/users/edit', user.id]);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  deleteUser(user: SuperUser): void {
    const me = this.auth.superUser();
    if (me && me.id === user.id) {
      this.toast.error('You cannot delete your own account');
      return;
    }

    const ref = this.dialog.open(ConfirmDialog, {
      data: `Delete "${user.name}"? This action cannot be undone.`,
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.api
          .delete(`users/${user.id}`)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.success('User deleted');
              // Optimistically remove from local signal — no full refetch needed
              this.users.update((list) => list.filter((u) => u.id !== user.id));
            },
            error: (err) => {
              this.toast.error(err?.error?.error ?? 'Delete failed');
            },
          });
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getRoleBadgeClass(roleName: string): string {
    switch (roleName?.toUpperCase()) {
      case 'SUPERADMIN':
        return 'badge--superadmin';
      case 'SUPERMANAGER':
        return 'badge--manager';
      default:
        return 'badge--user';
    }
  }

  isSelf(userId: number): boolean {
    return this.auth.superUser()?.id === userId;
  }

  nameInitial(name: unknown): string {
    if (typeof name !== 'string' || !name) return '?';
    return name.charAt(0).toUpperCase();
  }

  asRoleArray(roles: unknown): SuperUserRole[] {
    return Array.isArray(roles) ? (roles as SuperUserRole[]) : [];
  }

  trackByUserId(_: number, user: SuperUser): number {
    return user.id;
  }
}
