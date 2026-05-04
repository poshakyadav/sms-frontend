import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExamsService } from '../../../../../core/services/exams.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-template-manager',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './template-manager.html',
  styleUrl: './template-manager.scss',
})
export class TemplateManager implements OnInit {
  private examsService = inject(ExamsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  previewHtml = signal<string>('');

  form = this.fb.group({
    type: ['ADMIT_CARD' as 'ADMIT_CARD' | 'REPORT_CARD', Validators.required],
    name: ['', [Validators.required, Validators.minLength(3)]],
    htmlContent: ['', [Validators.required, Validators.minLength(100)]],
  });

  // Sample starter templates to help users
  readonly ADMIT_CARD_STARTER = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .logo { max-width: 80px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="header">
    <img src="{{schoolLogo}}" class="logo" alt="Logo" />
    <h2>{{schoolName}}</h2>
    <h3>Admit Card — {{examName}}</h3>
  </div>
  <p><strong>Student Name:</strong> {{studentName}}</p>
  <p><strong>Class:</strong> {{className}} — {{sectionName}}</p>
  <p><strong>Roll No:</strong> {{rollNumber}}</p>
  <p><strong>Date of Issue:</strong> {{currentDate}}</p>
  {{timetableTable}}
  <p style="margin-top:30px;">_____________________<br/>Authorized Signature</p>
</body>
</html>`;

  readonly REPORT_CARD_STARTER = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .logo { max-width: 80px; }
    .percentage { font-size: 2rem; font-weight: bold; color: #3b82f6; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="header">
    <img src="{{schoolLogo}}" class="logo" alt="Logo" />
    <h2>{{schoolName}}</h2>
    <h3>Report Card — {{examName}}</h3>
  </div>
  <p><strong>Student Name:</strong> {{studentName}}</p>
  <p><strong>Class:</strong> {{className}} — {{sectionName}}</p>
  <p><strong>Roll No:</strong> {{rollNumber}}</p>
  <div class="percentage">{{percentage}}%</div>
  {{marksTable}}
  <p style="margin-top:30px;">_____________________<br/>Class Teacher Signature</p>
</body>
</html>`;

  ngOnInit(): void {
    this.form.get('htmlContent')?.valueChanges.subscribe((v) => {
      this.previewHtml.set(v ?? '');
    });
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    forkJoin({
      admit: this.examsService.getTemplate('ADMIT_CARD'),
      report: this.examsService.getTemplate('REPORT_CARD'),
    }).subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.toast.error('Failed to load templates');
        this.loading.set(false);
      },
    });
  }

  loadTemplateForEdit(type: 'ADMIT_CARD' | 'REPORT_CARD'): void {
    this.examsService.getTemplate(type).subscribe({
      next: (res) => {
        if (res.template?.htmlContent) {
          this.form.patchValue({
            type: res.template.type,
            name: res.template.name,
            htmlContent: res.template.htmlContent,
          });
          this.previewHtml.set(res.template.htmlContent);
          this.toast.success('Template loaded for editing');
        } else {
          // Load a starter
          const starter =
            type === 'ADMIT_CARD' ? this.ADMIT_CARD_STARTER : this.REPORT_CARD_STARTER;
          this.form.patchValue({ type, htmlContent: starter });
          this.toast.info?.('No template found — starter loaded');
        }
      },
      error: () => this.toast.error('Failed to load template'),
    });
  }

  useStarter(type: 'ADMIT_CARD' | 'REPORT_CARD'): void {
    const starter = type === 'ADMIT_CARD' ? this.ADMIT_CARD_STARTER : this.REPORT_CARD_STARTER;
    this.form.patchValue({ type, htmlContent: starter });
    this.previewHtml.set(starter);
  }

  saveTemplate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill all required fields (HTML content must be ≥ 100 chars)');
      return;
    }

    this.saving.set(true);

    const payload = this.form.getRawValue() as {
      type: 'ADMIT_CARD' | 'REPORT_CARD';
      name: string;
      htmlContent: string;
    };

    this.examsService.createOrUpdateTemplate(payload).subscribe({
      next: () => {
        this.toast.success('Template saved successfully!');
        this.saving.set(false);
      },
      error: (err) => {
        this.toast.error(err?.message ?? 'Failed to save template');
        this.saving.set(false);
      },
    });
  }
}
