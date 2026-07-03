// features/school/users/bulk-photo-upload/bulk-photo-upload.ts

import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { AcademicsService, ClassSection } from '../../../../core/services/academics.service';
import {
  BulkAvatarUploadService,
  StudentForAvatarUpload,
} from '../../../../core/services/bulk-avatar-upload.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarPicker } from '../../../../shared/components/avatar-picker/avatar-picker';

type RowStatus = 'idle' | 'success' | 'error';

@Component({
  selector: 'app-bulk-photo-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AvatarPicker,
  ],
  templateUrl: './bulk-photo-upload.html',
  styleUrl: './bulk-photo-upload.scss',
})
export class BulkPhotoUpload {
  private academicsService = inject(AcademicsService);
  private bulkAvatarService = inject(BulkAvatarUploadService);
  private toast = inject(ToastService);
  readonly router = inject(Router);

  // ── Class-section selector ────────────────────────────────────────────────
  classSections = signal<ClassSection[]>([]);
  loadingClassSections = signal(false);
  selectedClassSectionId = signal<number | null>(null);

  // ── Students ───────────────────────────────────────────────────────────────
  students = signal<StudentForAvatarUpload[]>([]);
  loadingStudents = signal(false);
  searchQuery = signal('');

  // ── Staged files: userId -> File (not yet uploaded) ─────────────────────────
  pendingFiles = signal<Map<number, File>>(new Map());

  // ── Per-row result state after a save attempt ────────────────────────────────
  rowStatus = signal<Map<number, RowStatus>>(new Map());
  rowError = signal<Map<number, string>>(new Map());

  // ── Upload state ──────────────────────────────────────────────────────────
  uploading = signal(false);
  uploadProgressLabel = signal<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  activeClassSections = computed(() => this.classSections().filter((cs) => cs.isActive));

  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.students();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber ?? '').toLowerCase().includes(q) ||
        (s.admissionNumber ?? '').toLowerCase().includes(q)
    );
  });

  totalCount = computed(() => this.students().length);
  pendingCount = computed(() => this.pendingFiles().size);
  studentsWithPhotoCount = computed(
    () => this.students().filter((s) => !!s.avatarUrl).length
  );
  studentsWithoutPhotoCount = computed(
    () => this.totalCount() - this.studentsWithPhotoCount()
  );

  constructor() {
    this.loadClassSections();
  }

  // ── Warn on tab close if there's unsaved staged work ─────────────────────────
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.pendingCount() > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private loadClassSections(): void {
    this.loadingClassSections.set(true);
    this.academicsService.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections ?? []);
        this.loadingClassSections.set(false);
      },
      error: () => {
        this.toast.error('Failed to load class-sections');
        this.loadingClassSections.set(false);
      },
    });
  }

  onClassSectionChange(classSectionId: number): void {
    this.selectedClassSectionId.set(classSectionId);
    this.searchQuery.set('');
    this.pendingFiles.set(new Map());
    this.rowStatus.set(new Map());
    this.rowError.set(new Map());
    this.loadStudents(classSectionId);
  }

  private loadStudents(classSectionId: number): void {
    this.loadingStudents.set(true);
    this.bulkAvatarService.getStudentsByClassSection(classSectionId).subscribe({
      next: (res) => {
        this.students.set(res.students ?? []);
        this.loadingStudents.set(false);
      },
      error: () => {
        this.toast.error('Failed to load students for this class-section');
        this.loadingStudents.set(false);
      },
    });
  }

  // ── Per-row staging ────────────────────────────────────────────────────────

  onFileStaged(student: StudentForAvatarUpload, file: File): void {
    const map = new Map(this.pendingFiles());
    map.set(student.userId, file);
    this.pendingFiles.set(map);
    this.clearRowStatus(student.userId);
  }

  onFileCancelled(student: StudentForAvatarUpload): void {
    const map = new Map(this.pendingFiles());
    map.delete(student.userId);
    this.pendingFiles.set(map);
  }

  hasPendingChange(userId: number): boolean {
    return this.pendingFiles().has(userId);
  }

  rowStatusFor(userId: number): RowStatus {
    return this.rowStatus().get(userId) ?? 'idle';
  }

  rowErrorFor(userId: number): string | undefined {
    return this.rowError().get(userId);
  }

  private clearRowStatus(userId: number): void {
    const s = new Map(this.rowStatus());
    s.delete(userId);
    this.rowStatus.set(s);
    const e = new Map(this.rowError());
    e.delete(userId);
    this.rowError.set(e);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  saveAll(): void {
    const pending = this.pendingFiles();
    if (pending.size === 0) {
      this.toast.info('No new photos to upload.');
      return;
    }

    const items = Array.from(pending.entries()).map(([userId, file]) => ({ userId, file }));
    this.uploading.set(true);
    this.uploadProgressLabel.set(
      `Uploading ${items.length} photo${items.length !== 1 ? 's' : ''}…`
    );

    this.bulkAvatarService.bulkUploadAvatars(items).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.uploadProgressLabel.set(null);

        const newStatus = new Map(this.rowStatus());
        const newErrors = new Map(this.rowError());
        const newPending = new Map(this.pendingFiles());
        const updatedStudents = [...this.students()];

        res.uploaded.forEach((u) => {
          newStatus.set(u.userId, 'success');
          newErrors.delete(u.userId);
          newPending.delete(u.userId);
          const idx = updatedStudents.findIndex((s) => s.userId === u.userId);
          if (idx > -1) {
            updatedStudents[idx] = { ...updatedStudents[idx], avatarUrl: u.avatarUrl };
          }
        });

        res.failed.forEach((f) => {
          newStatus.set(f.userId, 'error');
          newErrors.set(f.userId, f.error);
          // Keep the staged file in `pending` so the row is still "ready"
          // and Save & Upload will retry it on the next click.
        });

        this.rowStatus.set(newStatus);
        this.rowError.set(newErrors);
        this.pendingFiles.set(newPending);
        this.students.set(updatedStudents);

        if (res.failed.length === 0) {
          this.toast.success(`All ${res.uploaded.length} photo(s) uploaded successfully!`);
        } else if (res.uploaded.length === 0) {
          this.toast.error(`Failed to upload ${res.failed.length} photo(s). Please retry.`);
        } else {
          this.toast.info(
            `${res.uploaded.length} uploaded, ${res.failed.length} failed — retry the failed ones below.`
          );
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadProgressLabel.set(null);
        this.toast.error(err?.error?.error ?? 'Bulk upload failed. Please try again.');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/school/users']);
  }
}