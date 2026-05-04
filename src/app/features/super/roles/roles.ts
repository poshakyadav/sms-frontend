import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { HasSuperPermissionDirective } from '../../../core/directives/has-permission.directive';

interface SuperPermission {
  id: number;
  slug: string;
  name: string;
  module: string;
}

interface SuperRole {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: SuperPermission[];
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    HasSuperPermissionDirective,
  ],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles implements OnInit {
  roles = signal<SuperRole[]>([]);
  allPermissions = signal<SuperPermission[]>([]);
  loading = signal(false);
  displayedColumns = ['name', 'permissions', 'system', 'actions'];

  // Inline form state
  editing = signal<SuperRole | null>(null);
  creating = signal(false);
  form!: FormGroup;
  saving = signal(false);

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private toast: ToastService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    Promise.all([
      this.api.get<{ success: boolean; roles: SuperRole[] }>('super/roles').toPromise(),
      this.api.get<{ success: boolean; permissions: SuperPermission[] }>('permissions').toPromise(),
    ])
      .then(([roles, perms]) => {
        this.roles.set(roles?.roles ?? []);
        this.allPermissions.set(perms?.permissions ?? []);
        this.loading.set(false);
      })
      .catch(() => {
        this.toast.error('Failed to load data');
        this.loading.set(false);
      });
  }

  startCreate() {
    this.creating.set(true);
    this.editing.set(null);
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      description: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(300)]],
      permissionIds: [[], Validators.required],
    });
  }

  startEdit(role: SuperRole) {
    if (role.isSystem) {
      this.toast.error('Cannot modify system roles');
      return;
    }
    this.creating.set(false);
    this.editing.set(role);
    this.form = this.fb.group({
      name: [role.name, [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      description: [
        role.description,
        [Validators.required, Validators.minLength(5), Validators.maxLength(300)],
      ],
      permissionIds: [role.permissions.map((p) => p.id)],
    });
  }

  cancelForm() {
    this.creating.set(false);
    this.editing.set(null);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const val = this.form.value;
    const editTarget = this.editing();

    const obs = editTarget
      ? this.api.put(`super/roles/${editTarget.id}`, val)
      : this.api.post('super/roles', val);

    obs.subscribe({
      next: () => {
        this.toast.success(editTarget ? 'Role updated' : 'Role created');
        this.saving.set(false);
        this.cancelForm();
        this.loadData();
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error ?? 'Operation failed');
        this.saving.set(false);
      },
    });
  }

  deleteRole(role: SuperRole) {
    if (role.isSystem) {
      this.toast.error('Cannot delete system roles');
      return;
    }
    const ref = this.dialog.open(ConfirmDialog, {
      data: `Delete role "${role.name}"? Users with this role must be reassigned first.`,
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`super/roles/${role.id}`).subscribe({
        next: () => {
          this.toast.success('Role deleted');
          this.loadData();
        },
        error: (err: any) => this.toast.error(err?.error?.error ?? 'Delete failed'),
      });
    });
  }

  getPermissionModules(perms: SuperPermission[]): Map<string, SuperPermission[]> {
    const map = new Map<string, SuperPermission[]>();
    for (const p of perms) {
      const mod = p.module ?? 'GENERAL';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(p);
    }
    return map;
  }

  /**
   * FIX: Angular's mat-table row context types `let role` as `unknown` when
   * the dataSource is a plain array signal. This helper casts the permissions
   * array so templates don't get "Object is of type 'unknown'" errors.
   */
  asPermArray(perms: unknown): SuperPermission[] {
    return (perms as SuperPermission[]) ?? [];
  }
}
