// role-detail-dialog.ts
// UPDATED: Shows category badge (Staff / Student / Parent) in the role detail view.
// Category is read from role.category (now included in getAllRoles response).

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Role, RoleCategory } from '../../../../core/services/roles.service';

interface DialogData {
  role: Role;
}

// Category metadata for display
interface CategoryMeta {
  label: string;
  icon: string;
  tooltip: string;
}

const CATEGORY_META: Record<RoleCategory, CategoryMeta> = {
  staff: {
    label: 'Staff',
    icon: 'manage_accounts',
    tooltip: 'Staff-category role — only staff permissions can be assigned',
  },
  student: {
    label: 'Student',
    icon: 'school',
    tooltip: 'Student-category role — only student permissions can be assigned',
  },
  parent: {
    label: 'Parent',
    icon: 'family_restroom',
    tooltip: 'Parent-category role — only parent permissions can be assigned',
  },
};

@Component({
  selector: 'app-role-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './role-detail-dialog.html',
  styleUrl: './role-detail-dialog.scss',
})
export class RoleDetailDialog {
  private dialogRef = inject(MatDialogRef<RoleDetailDialog>);
  data = inject(MAT_DIALOG_DATA) as DialogData;

  get role(): Role {
    return this.data.role;
  }

  get categoryMeta(): CategoryMeta {
    return CATEGORY_META[this.role.category] ?? CATEGORY_META['staff'];
  }

  get groupedPermissions(): Record<string, typeof this.role.permissions> {
    return this.role.permissions.reduce((acc, p) => {
      const mod = p.module || 'Other';
      if (!acc[mod]) acc[mod] = [];
      acc[mod].push(p);
      return acc;
    }, {} as Record<string, typeof this.role.permissions>);
  }

  get moduleEntries(): [string, typeof this.role.permissions][] {
    return Object.entries(this.groupedPermissions);
  }

  close(): void {
    this.dialogRef.close();
  }
}
