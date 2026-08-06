// bulk-student-upload.ts — v3 (production-grade, complete rewrite)
//
// Removed: rollNumber field (handled separately via Roll Numbers feature)
// Added:   UDISE warning display, progress tracking, rich guidance panels
//          ExcelJS styled template download, improved accessibility

import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import {
  BulkUploadService,
  BulkUploadResult,
  BulkUploadRowResult,
  ClassSectionCapacityInfo,
  EmailConflict,
  UsernameConflict,
} from '../../../../core/services/bulk-upload.service';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button';

export type UploadStep = 'select' | 'upload' | 'processing' | 'results';

@Component({
  selector: 'app-bulk-student-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, BackButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-student-upload.html',
  styleUrl: './bulk-student-upload.scss',
})
export class BulkStudentUploadComponent implements OnInit {
  private router = inject(Router);
  private academics = inject(AcademicsService);
  private bulkUpload = inject(BulkUploadService);

  // ── Step state ───────────────────────────────────────────────────────────────
  currentStep = signal<UploadStep>('select');

  // ── Class section ────────────────────────────────────────────────────────────
  classSections = signal<ClassSection[]>([]);
  loadingClassSections = signal(false);
  selectedClassSectionId = signal<number | ''>('');
  capacityInfo = signal<ClassSectionCapacityInfo | null>(null);
  loadingCapacity = signal(false);

  // ── File state ───────────────────────────────────────────────────────────────
  selectedFile = signal<File | null>(null);
  fileError = signal<string | null>(null);
  isDragOver = signal(false);
  uploading = signal(false);

  // ── Results ──────────────────────────────────────────────────────────────────
  uploadResult = signal<BulkUploadResult | null>(null);
  resultFilter = signal<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  // ── Email conflict popup ─────────────────────────────────────────────────────
  showConflictPopup = signal(false);
  emailConflicts = signal<EmailConflict[]>([]);
  usernameConflicts = signal<UsernameConflict[]>([]);
  conflictFilter = signal<'ALL' | 'DUPLICATE_IN_FILE' | 'ALREADY_IN_SCHOOL'>('ALL');

  // ── Template download state ──────────────────────────────────────────────────
  downloadingTemplate = signal(false);

  // ── Guide panel ──────────────────────────────────────────────────────────────
  showGuide = signal(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────────

  inSchoolEmailConflicts = computed(() =>
    this.emailConflicts().filter((c) => c.conflictType === 'ALREADY_IN_SCHOOL')
  );
  inFileEmailConflicts = computed(() =>
    this.emailConflicts().filter((c) => c.conflictType === 'DUPLICATE_IN_FILE')
  );
  inSchoolUsernameConflicts = computed(() =>
    this.usernameConflicts().filter((c) => c.conflictType === 'ALREADY_IN_SCHOOL')
  );
  inFileUsernameConflicts = computed(() =>
    this.usernameConflicts().filter((c) => c.conflictType === 'DUPLICATE_IN_FILE')
  );
  totalConflicts = computed(() => this.emailConflicts().length + this.usernameConflicts().length);

  filteredEmailConflicts = computed(() => {
    const f = this.conflictFilter();
    const all = this.emailConflicts();
    if (f === 'ALL') return all;
    return all.filter((c) => c.conflictType === f);
  });
  filteredUsernameConflicts = computed(() => {
    const f = this.conflictFilter();
    const all = this.usernameConflicts();
    if (f === 'ALL') return all;
    return all.filter((c) => c.conflictType === f);
  });


  // ===

  selectedClassSectionName = computed(() => {
    const id = this.selectedClassSectionId();
    const cs = this.classSections().find((c) => c.id === id);
    return cs ? `${cs.className} – ${cs.sectionName}` : '';
  });

  successRows = computed(() =>
    (this.uploadResult()?.results ?? []).filter((r) => r.status === 'SUCCESS')
  );
  failedRows = computed(() =>
    (this.uploadResult()?.results ?? []).filter((r) => r.status === 'FAILED')
  );
  filteredResults = computed(() => {
    const f = this.resultFilter();
    const results = this.uploadResult()?.results ?? [];
    if (f === 'ALL') return results;
    return results.filter((r) => r.status === f);
  });

  capacityPercent = computed(() => {
    const cap = this.capacityInfo();
    if (!cap || cap.maxAllowed === 0) return 0;
    return Math.min(100, Math.round((cap.existingStudents / cap.maxAllowed) * 100));
  });

  capacityAfterPercent = computed(() => {
    const cap = this.uploadResult()?.capacityInfo;
    if (!cap || cap.maxAllowed === 0) return 0;
    return Math.min(100, Math.round((cap.totalAfter / cap.maxAllowed) * 100));
  });

  udiseWarningCount = computed(
    () =>
      (this.uploadResult()?.results ?? []).filter(
        (r) => r.status === 'SUCCESS' && r.udiseWarnings && r.udiseWarnings.length > 0
      ).length
  );

  stepOrder: UploadStep[] = ['select', 'upload', 'results'];

  stepDone(step: UploadStep): boolean {
    return this.stepOrder.indexOf(this.currentStep()) > this.stepOrder.indexOf(step);
  }

  stepIndex(step: UploadStep): number {
    return this.stepOrder.indexOf(step) + 1;
  }

  ngOnInit(): void {
    this.loadClassSections();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLASS SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  private loadClassSections(): void {
    this.loadingClassSections.set(true);
    this.academics.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections.filter((cs: ClassSection) => cs.isActive));
        this.loadingClassSections.set(false);
      },
      error: () => this.loadingClassSections.set(false),
    });
  }

  onClassSectionChange(value: string): void {
    const id = value !== '' ? parseInt(value, 10) : '';
    this.selectedClassSectionId.set(id);
    this.capacityInfo.set(null);
    if (id) {
      this.loadingCapacity.set(true);
      this.bulkUpload.getCapacityInfo(id).subscribe({
        next: (res) => {
          this.capacityInfo.set(res);
          this.loadingCapacity.set(false);
        },
        error: () => this.loadingCapacity.set(false),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  async downloadTemplate(): Promise<void> {
    this.downloadingTemplate.set(true);
    try {
      await this.bulkUpload.downloadTemplate();
    } finally {
      this.downloadingTemplate.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────────

  goToUpload(): void {
    this.currentStep.set('upload');
  }

  goBack(): void {
    this.router.navigate(['/school/students']);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FILE HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.validateAndSetFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.validateAndSetFile(file);
  }

  private validateAndSetFile(file: File): void {
    this.fileError.set(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.fileError.set(
        'Only Excel files (.xlsx or .xls) are accepted. Please use the provided template.'
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.fileError.set(
        'File size must be less than 10 MB. Split into smaller batches if needed.'
      );
      return;
    }
    this.selectedFile.set(file);
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  submitUpload(): void {
    const file = this.selectedFile();
    const classSectionId = this.selectedClassSectionId();
    if (!file || !classSectionId) return;

    this.uploading.set(true);
    this.fileError.set(null);
    this.currentStep.set('processing');

    this.bulkUpload.uploadStudents(classSectionId, file).subscribe({
      next: (result) => {
        this.uploadResult.set(result);
        this.uploading.set(false);
        this.currentStep.set('results');
      },
      error: (err) => {
        this.uploading.set(false);
        const body = err?.error as BulkUploadResult | undefined;

        const hasEmailConflicts = !!body?.emailConflicts?.length;
        const hasUsernameConflicts = !!body?.usernameConflicts?.length;

        if (err?.status === 409 && (hasEmailConflicts || hasUsernameConflicts)) {
          this.emailConflicts.set(body?.emailConflicts ?? []);
          this.usernameConflicts.set(body?.usernameConflicts ?? []); // NEW
          this.conflictFilter.set('ALL');
          this.showConflictPopup.set(true);
          this.currentStep.set('upload');
          return;
        }

        this.currentStep.set('upload');
        this.fileError.set(
          err?.error?.error || err?.error?.message || err?.message || 'Upload failed. Please try again.'
        );
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFLICT POPUP
  // ─────────────────────────────────────────────────────────────────────────────

  closeConflictPopup(): void {
    this.showConflictPopup.set(false);
  }

  downloadConflictReport(): void {
    const lines = ['Row #,Field,Name,Value,Issue'];
    this.emailConflicts().forEach((c) => {
      lines.push(
        `${c.rowNumber},Email,"${c.name}","${c.email}","${
          c.conflictType === 'ALREADY_IN_SCHOOL' ? 'Email already registered in school' : 'Duplicate email within file'
        }"`
      );
    });
    this.usernameConflicts().forEach((c) => {
      lines.push(
        `${c.rowNumber},Username,"${c.name}","${c.username}","${
          c.conflictType === 'ALREADY_IN_SCHOOL' ? 'Username already taken in school' : 'Duplicate username within file'
        }"`
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'upload_conflicts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULTS
  // ─────────────────────────────────────────────────────────────────────────────

  resetAndStartOver(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
    this.uploadResult.set(null);
    this.resultFilter.set('ALL');
    this.emailConflicts.set([]);
    this.usernameConflicts.set([]);
    this.showConflictPopup.set(false);
    this.currentStep.set('upload');
  }

  downloadResultsReport(): void {
    const results = this.uploadResult()?.results ?? [];
    const lines = [
      'Row #,Name,Email,Username,Status,Detail',
      ...results.map(
        (r) =>
          `${r.rowNumber},"${r.name}","${r.email || ''}","${r.username || ''}",${r.status},"${
            r.status === 'SUCCESS' ? `User ID: ${r.userId}` : r.error ?? ''
          }"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'upload_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  getBannerClass(): string {
    const r = this.uploadResult();
    if (!r) return '';
    if (r.summary.failed === 0) return 'banner-success';
    if (r.summary.successful > 0) return 'banner-partial';
    return 'banner-error';
  }
}
