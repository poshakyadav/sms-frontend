// role-clone-dialog.ts
// UPDATED: Shows the source role's category badge (Staff / Student / Parent)
// since cloned roles automatically inherit the source role's category.
// No category selector needed — inheritance is automatic on the backend.

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RolesService, Role, RoleCategory } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';

interface DialogData {
  role: Role;
}

// Category metadata — same as role-form-dialog and role-detail-dialog
interface CategoryMeta {
  label: string;
  icon: string;
  colorClass: string;
  tooltip: string;
}

const CATEGORY_META: Record<RoleCategory, CategoryMeta> = {
  staff: {
    label: 'Staff',
    icon: 'manage_accounts',
    colorClass: 'cat-staff',
    tooltip: 'Staff-category role — only staff permissions will be cloned',
  },
  student: {
    label: 'Student',
    icon: 'school',
    colorClass: 'cat-student',
    tooltip: 'Student-category role — only student permissions will be cloned',
  },
  parent: {
    label: 'Parent',
    icon: 'family_restroom',
    colorClass: 'cat-parent',
    tooltip: 'Parent-category role — only parent permissions will be cloned',
  },
};

@Component({
  selector: 'app-role-clone-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './role-clone-dialog.html',
  styleUrl: './role-clone-dialog.scss',
})
export class RoleCloneDialog implements OnInit {
  private fb = inject(FormBuilder);
  private rolesService = inject(RolesService);
  private toast = inject(ToastService);
  private dialogRef = inject(MatDialogRef<RoleCloneDialog>);
  data = inject(MAT_DIALOG_DATA) as DialogData;

  form!: FormGroup;
  saving = signal(false);

  get sourceRole(): Role {
    return this.data.role;
  }

  /** Category metadata for the source role's category badge */
  get categoryMeta(): CategoryMeta {
    return CATEGORY_META[this.sourceRole.category] ?? CATEGORY_META['staff'];
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [
        `${this.sourceRole.name} (Copy)`,
        [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
      ],
      description: [`Cloned from "${this.sourceRole.name}"`, [Validators.maxLength(500)]],
    });
  }

  clone(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const { name, description } = this.form.value;

    this.rolesService.cloneRole(this.sourceRole.id, { name, description }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res.role);
      },
      error: (err) => {
        const msg = err?.error?.error ?? err?.message ?? 'Failed to clone role';
        this.toast.error(msg);
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
