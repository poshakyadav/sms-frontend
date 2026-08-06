import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HolidayImpactPreview } from '../../../../core/services/attendance.service';

export interface HolidayImpactConfirmDialogData {
  scopeLabel: string;
  fromDate: string;
  toDate: string;
  dayCount: number;
  preview: HolidayImpactPreview;
}

@Component({
  selector: 'app-holiday-impact-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './holiday-impact-confirm-dialog.html',
  styleUrl: './holiday-impact-confirm-dialog.scss',
})
export class HolidayImpactConfirmDialog {
  data = inject<HolidayImpactConfirmDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<HolidayImpactConfirmDialog, boolean>);

  confirm() { this.ref.close(true); }
  cancel() { this.ref.close(false); }
}