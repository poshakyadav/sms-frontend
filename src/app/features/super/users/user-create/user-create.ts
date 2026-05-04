import { Component, OnInit, signal } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

export interface SuperRole {
  id: number;
  name: string;
  isSystem: boolean;
  description?: string;
}

@Component({
  selector: 'app-user-create',
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
    MatTooltipModule,
    MatIconModule,
  ],
  templateUrl: './user-create.html',
  styleUrl: './user-create.scss',
})
export class UserCreate implements OnInit {
  form: FormGroup;
  loading = signal(false);
  saving = signal(false);
  allRoles = signal<SuperRole[]>([]);
  showPassword = signal(false);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {
    this.form = fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      roleIds: [[], Validators.required],
    });
  }

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.loading.set(true);
    this.api.get<{ success: boolean; roles: SuperRole[] }>('super/roles').subscribe({
      next: (res) => {
        this.allRoles.set(res.roles ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load roles');
        this.loading.set(false);
      },
    });
  }

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

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.value;
    if (!val.roleIds?.length) {
      this.toast.error('Please select at least one role');
      return;
    }
    this.saving.set(true);
    this.api
      .post('users', {
        name: val.name,
        email: val.email,
        password: val.password,
        roleIds: val.roleIds,
      })
      .subscribe({
        next: () => {
          this.toast.success('User created successfully');
          this.router.navigate(['/super/users']);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.error ?? 'Failed to create user');
          this.saving.set(false);
        },
      });
  }

  cancel() {
    this.router.navigate(['/super/users']);
  }

  onRoleToggle(roleId: number, checked: boolean) {
    const current: number[] = [...(this.form.get('roleIds')?.value ?? [])];
    if (checked) {
      if (!current.includes(roleId)) current.push(roleId);
    } else {
      const idx = current.indexOf(roleId);
      if (idx > -1) current.splice(idx, 1);
    }
    this.form.patchValue({ roleIds: current });
  }

  hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }
}
