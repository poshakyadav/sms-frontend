// unenrollment-detail-dialog.ts
// Dialog to show full unenrollment details: reason, type, class history, and stats.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UnenrollmentDetailPrefetch {
  lastClassName?: string;
  lastSectionName?: string;
  lastRollNumber?: string;
  unenrollmentType?: string | null;
  unenrollmentReason?: string;
  unenrolledAt?: string;
  email?: string;
  phone?: string;
  gender?: string;
  bloodGroup?: string;
  admissionDate?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface UnenrollmentDetailDialogData {
  studentId: number;
  studentName: string;
  // If passed directly (from list data), skip the API call
  prefetchedData?: UnenrollmentDetailPrefetch;
}

@Component({
  selector: 'app-unenrollment-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './unenrollment-detail-dialog.html',
  styleUrl: './unenrollment-detail-dialog.scss',
})
export class UnenrollmentDetailDialog {
  data: UnenrollmentDetailDialogData = inject(MAT_DIALOG_DATA);

  /**
   * Narrows `prefetchedData` to a guaranteed non-undefined object.
   * Returns an empty object fallback so the template never needs to
   * re-check for undefined — every field access is safe via optional chaining.
   *
   * Using a plain getter (not a signal) is intentional: this dialog is
   * read-only and the data never changes after injection, so there is no
   * need for change-detection reactivity here.
   */
  get p(): UnenrollmentDetailPrefetch {
    return this.data.prefetchedData ?? {};
  }

  // ── Computed style / label helpers ────────────────────────────────────────

  headerClass = computed(() => {
    const type = this.p.unenrollmentType;
    if (type === 'TEMPORARY') return 'temporary-header';
    if (type === 'PERMANENT') return 'permanent-header';
    return '';
  });

  typeBadgeClass = computed(() => {
    const type = this.p.unenrollmentType;
    if (type === 'TEMPORARY') return 'status-badge temporary-badge';
    if (type === 'PERMANENT') return 'status-badge permanent-badge';
    return 'status-badge';
  });

  typeIcon = computed(() => {
    const type = this.p.unenrollmentType;
    if (type === 'TEMPORARY') return 'schedule';
    if (type === 'PERMANENT') return 'block';
    return 'info';
  });

  typeLabel = computed(() => {
    const type = this.p.unenrollmentType;
    if (type === 'TEMPORARY') return 'Temporarily Unenrolled';
    if (type === 'PERMANENT') return 'Permanently Unenrolled';
    return 'Unenrolled';
  });

  // ── Utilities ─────────────────────────────────────────────────────────────

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }
}
