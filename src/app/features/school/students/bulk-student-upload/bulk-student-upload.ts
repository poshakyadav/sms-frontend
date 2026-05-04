// bulk-student-upload.component.ts — v2 (production-grade)

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
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
} from '../../../../core/services/bulk-upload.service';

type UploadStep = 'select' | 'upload' | 'processing' | 'results';

@Component({
  selector: 'app-bulk-student-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-student-upload.html',
  styleUrl: './bulk-student-upload.scss',
})
export class BulkStudentUploadComponent {
  private router = inject(Router);
  private academics = inject(AcademicsService);
  private bulkUpload = inject(BulkUploadService);

  // ── State ──────────────────────────────────────────────────────────────────
  currentStep = signal<UploadStep>('select');
  classSections = signal<ClassSection[]>([]);
  loadingClassSections = signal(false);
  // selectedClassSectionId = signal<number | null>(null);
  selectedClassSectionId = signal<number | ''>('');
  capacityInfo = signal<ClassSectionCapacityInfo | null>(null);
  loadingCapacity = signal(false);
  selectedFile = signal<File | null>(null);
  fileError = signal<string | null>(null);
  isDragOver = signal(false);
  uploading = signal(false);
  uploadResult = signal<BulkUploadResult | null>(null);
  resultFilter = signal<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  // Email conflict popup
  showConflictPopup = signal(false);
  emailConflicts = signal<EmailConflict[]>([]);
  conflictFilter = signal<'ALL' | 'DUPLICATE_IN_FILE' | 'ALREADY_IN_SCHOOL'>('ALL');

  // ── Computed ───────────────────────────────────────────────────────────────
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
    const filter = this.resultFilter();
    const results = this.uploadResult()?.results ?? [];
    if (filter === 'ALL') return results;
    return results.filter((r) => r.status === filter);
  });

  // Conflict popup computed
  inSchoolConflicts = computed(() =>
    this.emailConflicts().filter((c) => c.conflictType === 'ALREADY_IN_SCHOOL')
  );
  inFileConflicts = computed(() =>
    this.emailConflicts().filter((c) => c.conflictType === 'DUPLICATE_IN_FILE')
  );
  filteredConflicts = computed(() => {
    const f = this.conflictFilter();
    const all = this.emailConflicts();
    if (f === 'ALL') return all;
    return all.filter((c) => c.conflictType === f);
  });

  // Capacity fill percentage
  capacityPercent = computed(() => {
    const cap = this.capacityInfo();
    if (!cap) return 0;
    return Math.round((cap.existingStudents / cap.maxAllowed) * 100);
  });

  stepDone(step: UploadStep): boolean {
    const order: UploadStep[] = ['select', 'upload', 'results'];
    return order.indexOf(this.currentStep()) > order.indexOf(step);
  }

  constructor() {
    this.loadClassSections();
  }

  // ── Load class sections ────────────────────────────────────────────────────
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

  // ── Class section selection ────────────────────────────────────────────────
  onClassSectionChange(value: string): void {
    // const id = value ? parseInt(value) : null;
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

  // ── Template download ──────────────────────────────────────────────────────
  downloadTemplate(): void {
    this.bulkUpload.downloadTemplate();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  goToUpload(): void {
    this.currentStep.set('upload');
  }

  // ── File handling ──────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.validateAndSetFile(file);
    // Reset input so the same file can be re-selected after removing
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
      this.fileError.set('Only .xlsx and .xls files are supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.fileError.set('File size must be less than 5 MB');
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
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Submit upload ──────────────────────────────────────────────────────────
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

        // HTTP 409 = email conflicts — show the popup, stay on upload step
        const body = err?.error as BulkUploadResult | undefined;
        if (err?.status === 409 && body?.emailConflicts?.length) {
          this.emailConflicts.set(body.emailConflicts);
          this.conflictFilter.set('ALL');
          this.showConflictPopup.set(true);
          this.currentStep.set('upload');
          return;
        }

        // Other errors — show inline
        this.currentStep.set('upload');
        this.fileError.set(
          err?.error?.error ||
            err?.error?.message ||
            err?.message ||
            'Upload failed. Please try again.'
        );
      },
    });
  }

  // ── Conflict popup actions ─────────────────────────────────────────────────
  closeConflictPopup(): void {
    this.showConflictPopup.set(false);
  }

  downloadConflictReport(): void {
    const conflicts = this.emailConflicts();
    const lines = [
      'Row #,Name,Email,Issue',
      ...conflicts.map(
        (c) =>
          `${c.rowNumber},"${c.name}","${c.email}","${
            c.conflictType === 'ALREADY_IN_SCHOOL'
              ? 'Email already registered in school'
              : 'Duplicate email within file'
          }"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email_conflicts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Results actions ────────────────────────────────────────────────────────
  resetAndStartOver(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
    this.uploadResult.set(null);
    this.resultFilter.set('ALL');
    this.emailConflicts.set([]);
    this.showConflictPopup.set(false);
    this.currentStep.set('upload');
  }

  goBack(): void {
    this.router.navigate(['/school/students']);
  }
}
