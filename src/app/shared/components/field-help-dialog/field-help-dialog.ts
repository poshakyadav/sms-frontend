import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-field-help-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './field-help-dialog.html',
  styleUrl: './field-help-dialog.scss',
})
export class FieldHelpDialog {
  dialogRef = inject(MatDialogRef<FieldHelpDialog>);
  data = inject(MAT_DIALOG_DATA); // { title: string, content: string }

  // No additional logic needed; content is passed via data

}
