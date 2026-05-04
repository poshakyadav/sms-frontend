// confirm-dialog.ts
// UPDATED: Accepts structured DialogData object (title, message, confirmText, confirmColor)
// instead of a plain string. Fully themed via CSS custom properties.

import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 'warn' | 'primary' | 'accent' — drives the confirm button style */
  confirmColor?: 'warn' | 'primary' | 'accent';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  get title(): string {
    return this.data?.title ?? 'Confirm Action';
  }

  get message(): string {
    // Support both plain-string legacy usage and the new structured object
    return typeof this.data === 'string'
      ? (this.data as unknown as string)
      : this.data?.message ?? '';
  }

  get confirmText(): string {
    return this.data?.confirmText ?? 'Confirm';
  }

  get cancelText(): string {
    return this.data?.cancelText ?? 'Cancel';
  }

  get isDestructive(): boolean {
    return this.data?.confirmColor === 'warn';
  }

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
