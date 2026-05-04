import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { HasSuperPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { SuperUser } from '../users/users';

export interface SuperRole {
  id: number;
  name: string;
  isSystem: boolean;
  description?: string;
  permissions: { id: number; slug: string; name: string; module: string }[];
}

export interface SuperPermission {
  id: number;
  slug: string;
  name: string;
  module: string;
}

@Component({
  selector: 'app-user-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatIconModule,
    HasSuperPermissionDirective,
  ],
  templateUrl: './user-edit.html',
  styleUrl: './user-edit.scss',
})
export class UserEdit implements OnInit {
  // ── Services ───────────────────────────────────────────────────────────────
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  public auth = inject(AuthService);

  // ── State ──────────────────────────────────────────────────────────────────
  userId!: number;
  user = signal<SuperUser | null>(null);

  activeTab = signal<'profile' | 'roles' | 'permissions'>('profile');
  loading = signal(false);
  saving = signal(false);
  savingRoles = signal(false);
  savingPermissions = signal(false);
  showPassword = signal(false);

  allRoles = signal<SuperRole[]>([]);
  allPermissions = signal<SuperPermission[]>([]);
  userDirectPermissions = signal<number[]>([]);

  // ── Forms ──────────────────────────────────────────────────────────────────
  profileForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    newPassword: ['', [Validators.minLength(8)]],
    isActive: [true],
  });

  rolesForm: FormGroup = this.fb.group({
    roleIds: [[], Validators.required],
  });

  // ── Computed ───────────────────────────────────────────────────────────────
  permissionModules = computed(() => {
    const perms = this.allPermissions();
    const map = new Map<string, SuperPermission[]>();
    for (const p of perms) {
      const mod = p.module || 'GENERAL';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(p);
    }
    return map;
  });

  selectedRoleIds = computed(() => (this.rolesForm.get('roleIds')?.value as number[]) ?? []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.userId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
    if (!this.userId) {
      this.router.navigate(['/super/users']);
      return;
    }
    this.loadData();
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  loadData(): void {
    this.loading.set(true);

    const canManagePerms = this.auth.hasAnySuperPermission(['permissions.manage']);
    const userPerms$ = canManagePerms
      ? this.api.get<{ success: boolean; permissions: SuperPermission[] }>(
          `users/${this.userId}/permissions`
        )
      : of<{ success: boolean; permissions: SuperPermission[] }>({
          success: true,
          permissions: [],
        });

    forkJoin({
      user: this.api.get<{ success: boolean; user: SuperUser }>(`users/${this.userId}`),
      roles: this.api.get<{ success: boolean; roles: SuperRole[] }>('super/roles'),
      perms: this.api.get<{ success: boolean; permissions: SuperPermission[] }>('permissions'),
      userPerms: userPerms$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ user, roles, perms, userPerms }) => {
          const u = user.user;

          // Set signals first
          this.user.set(u);
          this.allRoles.set(roles.roles ?? []);
          this.allPermissions.set(perms.permissions ?? []);
          this.userDirectPermissions.set((userPerms.permissions ?? []).map((p) => p.id));

          // Patch forms
          this.profileForm.patchValue({
            name: u.name,
            email: u.email,
            isActive: u.isActive,
          });
          this.rolesForm.patchValue({
            roleIds: u.roles?.map((r) => r.id) ?? [],
          });

          // Set loading false LAST — this is what drives the @if in the template
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load user data');
          this.loading.set(false);
          this.router.navigate(['/super/users']);
        },
      });
  }

  // ── Save handlers ──────────────────────────────────────────────────────────
  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const val = this.profileForm.value;
    const payload: Record<string, unknown> = {
      name: val.name,
      email: val.email,
      isActive: val.isActive,
    };
    if (val.newPassword) payload['newPassword'] = val.newPassword;

    this.api
      .put(`users/${this.userId}`, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Profile updated');
          // Clear the password field after a successful save
          this.profileForm.get('newPassword')?.reset('');
          this.saving.set(false);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.error ?? 'Failed to update profile');
          this.saving.set(false);
        },
      });
  }

  saveRoles(): void {
    const roleIds = this.rolesForm.value.roleIds as number[];
    if (!roleIds?.length) {
      this.toast.error('Select at least one role');
      return;
    }
    this.savingRoles.set(true);
    this.api
      .put(`users/${this.userId}/roles`, { roleIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Roles updated. User must re-login.');
          this.savingRoles.set(false);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.error ?? 'Failed to update roles');
          this.savingRoles.set(false);
        },
      });
  }

  savePermissions(): void {
    this.savingPermissions.set(true);
    this.api
      .put(`users/${this.userId}/permissions`, {
        permissionIds: this.userDirectPermissions(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Permissions updated.');
          this.savingPermissions.set(false);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.error ?? 'Failed to update permissions');
          this.savingPermissions.set(false);
        },
      });
  }

  // ── Role / permission toggles ──────────────────────────────────────────────
  onRoleToggle(roleId: number, checked: boolean): void {
    const current: number[] = [...(this.rolesForm.value.roleIds ?? [])];
    if (checked) {
      if (!current.includes(roleId)) current.push(roleId);
    } else {
      const idx = current.indexOf(roleId);
      if (idx > -1) current.splice(idx, 1);
    }
    this.rolesForm.patchValue({ roleIds: current });
  }

  togglePermission(permId: number, checked: boolean): void {
    this.userDirectPermissions.update((current) => {
      const next = [...current];
      if (checked) {
        if (!next.includes(permId)) next.push(permId);
      } else {
        const idx = next.indexOf(permId);
        if (idx > -1) next.splice(idx, 1);
      }
      return next;
    });
  }

  hasPermission(permId: number): boolean {
    return this.userDirectPermissions().includes(permId);
  }

  isRoleSelected(roleId: number): boolean {
    return ((this.rolesForm.get('roleIds')?.value as number[]) ?? []).includes(roleId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getRoleBadgeClass(name: string): string {
    switch (name?.toUpperCase()) {
      case 'SUPERADMIN':
        return 'badge--superadmin';
      case 'SUPERMANAGER':
        return 'badge--manager';
      default:
        return 'badge--user';
    }
  }

  nameInitial(name: string | undefined): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  hasError(form: FormGroup, field: string, error: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }

  cancel(): void {
    this.router.navigate(['/super/users']);
  }
}
