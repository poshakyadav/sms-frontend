// features/school/students/udise/udise-export-dialog/udise-export-dialog.ts
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  StudentUdiseService,
  UDISECompletenessReport,
} from '../../../../../core/services/student-udise.service';
import {
  AcademicsService,
  AcademicYear,
  ClassSection,
} from '../../../../../core/services/academics.service';

@Component({
  selector: 'app-udise-export-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <!-- Backdrop -->
    <div class="dialog-backdrop" (click)="onBackdropClick($event)">
      <div class="export-dialog" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="export-dialog__header">
          <div class="export-dialog__header-icon">
            <mat-icon>download</mat-icon>
          </div>
          <div class="export-dialog__header-text">
            <h2>Export UDISE+ Data</h2>
            <p>Download SDMS-compatible Excel file for portal upload</p>
          </div>
          <button class="export-dialog__close" (click)="close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="export-dialog__body">
          <!-- Info banner -->
          <div class="export-info-banner">
            <mat-icon>info_outline</mat-icon>
            <div>
              <strong>UDISE+ 2025-26 SDMS Format</strong>
              <p>
                The exported Excel file is ready for direct upload to
                <a href="https://sdms.udiseplus.gov.in" target="_blank" rel="noopener">
                  sdms.udiseplus.gov.in
                </a>
                — no reformatting required.
              </p>
            </div>
          </div>

          <!-- Filters -->
          <div class="export-filters">
            <div class="export-filter-group">
              <label class="export-filter-label">
                <mat-icon>calendar_today</mat-icon>
                Academic Year
              </label>
              <select
                class="export-select"
                [(ngModel)]="selectedYearId"
                (ngModelChange)="onFilterChange()"
              >
                <option [value]="null">Current Academic Year</option>
                @for (y of academicYears(); track y.id) {
                <option [value]="y.id">{{ y.name }}</option>
                }
              </select>
            </div>

            <div class="export-filter-group">
              <label class="export-filter-label">
                <mat-icon>class</mat-icon>
                Class / Section
                <span class="export-filter-optional">(optional)</span>
              </label>
              <select
                class="export-select"
                [(ngModel)]="selectedClassSectionId"
                (ngModelChange)="onFilterChange()"
              >
                <option [value]="null">All Classes</option>
                @for (cs of classSections(); track cs.id) {
                <option [value]="cs.id">{{ cs.className }} – {{ cs.sectionName }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Preview stats -->
          @if (previewLoading()) {
          <div class="export-preview export-preview--loading">
            <mat-spinner diameter="24"></mat-spinner>
            <span>Calculating preview…</span>
          </div>
          } @else if (preview()) {
          <div class="export-preview">
            <div class="export-preview__stat">
              <span class="export-preview__stat-value">{{ preview()!.summary.totalStudents }}</span>
              <span class="export-preview__stat-label">Students</span>
            </div>
            <div class="export-preview__divider"></div>
            <div class="export-preview__stat">
              <span class="export-preview__stat-value export-preview__stat-value--success">
                {{ preview()!.summary.fullyComplete }}
              </span>
              <span class="export-preview__stat-label">Complete</span>
            </div>
            <div class="export-preview__divider"></div>
            <div class="export-preview__stat">
              <span class="export-preview__stat-value export-preview__stat-value--warning">
                {{ preview()!.summary.partiallyComplete + preview()!.summary.notStarted }}
              </span>
              <span class="export-preview__stat-label">Incomplete</span>
            </div>
            <div class="export-preview__divider"></div>
            <div class="export-preview__stat">
              <span class="export-preview__stat-value export-preview__stat-value--primary">
                {{ preview()!.summary.averageScore }}%
              </span>
              <span class="export-preview__stat-label">Avg Score</span>
            </div>
          </div>

          @if (preview()!.summary.totalStudents === 0) {
          <div class="export-empty-warning">
            <mat-icon>warning_amber</mat-icon>
            No enrolled students found for the selected filters.
          </div>
          } }

          <!-- Sheets included -->
          <div class="export-sheets">
            <div class="export-sheets__title">Included in the export:</div>
            <div class="export-sheets__list">
              @for (sheet of sheets; track sheet.name) {
              <div class="export-sheet-item">
                <mat-icon [class]="'sheet-icon sheet-icon--' + sheet.color">{{
                  sheet.icon
                }}</mat-icon>
                <div>
                  <div class="export-sheet-item__name">{{ sheet.name }}</div>
                  <div class="export-sheet-item__desc">{{ sheet.desc }}</div>
                </div>
              </div>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="export-dialog__footer">
          <button class="export-btn export-btn--cancel" (click)="close()">Cancel</button>
          <button
            class="export-btn export-btn--primary"
            [disabled]="exporting() || preview()?.summary?.totalStudents === 0"
            (click)="doExport()"
          >
            @if (exporting()) {
            <mat-spinner diameter="16"></mat-spinner>
            <span>Generating…</span>
            } @else {
            <mat-icon>download</mat-icon>
            <span>Download Excel</span>
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* ── Backdrop ─────────────────────────────────────────────────── */
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.48);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1200;
        padding: 16px;
        animation: fadeIn 0.15s ease;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* ── Dialog box ───────────────────────────────────────────────── */
      .export-dialog {
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg),
          0 0 0 1px color-mix(in srgb, var(--color-primary) 10%, transparent);
        width: 100%;
        max-width: 520px;
        max-height: 90vh;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
        animation: slideUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      /* ── Header ───────────────────────────────────────────────────── */
      .export-dialog__header {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 22px 24px 18px;
        border-bottom: 1px solid var(--color-divider);
      }

      .export-dialog__header-icon {
        width: 46px;
        height: 46px;
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon {
          font-size: 22px;
          height: 22px;
          width: 22px;
          color: var(--color-primary);
        }
      }

      .export-dialog__header-text {
        flex: 1;
        h2 {
          margin: 0 0 3px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        p {
          margin: 0;
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }
      }

      .export-dialog__close {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s ease;
        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
        }
        &:hover {
          background: var(--color-hover);
          color: var(--color-text-primary);
        }
      }

      /* ── Body ─────────────────────────────────────────────────────── */
      .export-dialog__body {
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      /* ── Info banner ──────────────────────────────────────────────── */
      .export-info-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: color-mix(in srgb, var(--color-info) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-info) 18%, transparent);
        border-radius: var(--radius-sm);
        font-size: 0.82rem;
        color: color-mix(in srgb, var(--color-info) 70%, var(--color-text-primary));
        line-height: 1.55;

        mat-icon {
          font-size: 17px;
          height: 17px;
          width: 17px;
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--color-info);
        }

        strong {
          display: block;
          font-weight: 700;
          font-size: 0.84rem;
          margin-bottom: 2px;
        }
        p {
          margin: 0;
        }

        a {
          color: var(--color-info);
          font-weight: 600;
          text-decoration: underline;
          &:hover {
            opacity: 0.75;
          }
        }
      }

      /* ── Filters ──────────────────────────────────────────────────── */
      .export-filters {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .export-filter-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .export-filter-label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        mat-icon {
          font-size: 14px;
          height: 14px;
          width: 14px;
          color: var(--color-text-muted);
        }
      }

      .export-filter-optional {
        font-size: 0.68rem;
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
        color: var(--color-text-muted);
        margin-left: 2px;
      }

      .export-select {
        padding: 9px 12px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-surface);
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-family: inherit;
        outline: none;
        cursor: pointer;
        transition: border-color 0.15s ease;
        &:focus {
          border-color: var(--color-primary);
        }
      }

      /* ── Preview stats ────────────────────────────────────────────── */
      .export-preview {
        display: flex;
        align-items: center;
        gap: 0;
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        overflow: hidden;

        &--loading {
          justify-content: center;
          gap: 10px;
          padding: 16px;
          span {
            font-size: 0.84rem;
            color: var(--color-text-muted);
          }
        }
      }

      .export-preview__stat {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 14px 8px;
        gap: 4px;
      }

      .export-preview__divider {
        width: 1px;
        height: 36px;
        background: var(--color-divider);
        flex-shrink: 0;
      }

      .export-preview__stat-value {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--color-text-primary);
        line-height: 1;
        &--success {
          color: var(--color-success);
        }
        &--warning {
          color: var(--color-warning);
        }
        &--primary {
          color: var(--color-primary);
        }
      }

      .export-preview__stat-label {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }

      /* ── Empty warning ────────────────────────────────────────────── */
      .export-empty-warning {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-warning) 18%, transparent);
        border-radius: var(--radius-sm);
        font-size: 0.82rem;
        color: color-mix(in srgb, var(--color-warning) 70%, var(--color-text-primary));
        font-weight: 600;
        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
          color: var(--color-warning);
        }
      }

      /* ── Sheets list ──────────────────────────────────────────────── */
      .export-sheets {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }

      .export-sheets__title {
        padding: 10px 14px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
        background: var(--color-hover);
        border-bottom: 1px solid var(--color-divider);
      }

      .export-sheets__list {
        display: flex;
        flex-direction: column;
      }

      .export-sheet-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--color-divider);
        &:last-child {
          border-bottom: none;
        }
      }

      .sheet-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
        flex-shrink: 0;
        &--primary {
          color: var(--color-primary);
        }
        &--success {
          color: var(--color-success);
        }
        &--warning {
          color: var(--color-warning);
        }
        &--info {
          color: var(--color-info);
        }
      }

      .export-sheet-item__name {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .export-sheet-item__desc {
        font-size: 0.72rem;
        color: var(--color-text-muted);
      }

      /* ── Footer ───────────────────────────────────────────────────── */
      .export-dialog__footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 24px 22px;
        border-top: 1px solid var(--color-divider);
      }

      .export-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 20px;
        border-radius: var(--radius-sm);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        border: 1px solid;
        transition: all 0.15s ease;
        mat-icon {
          font-size: 17px;
          height: 17px;
          width: 17px;
        }

        &--cancel {
          background: transparent;
          border-color: var(--color-border);
          color: var(--color-text-secondary);
          &:hover {
            background: var(--color-hover);
            color: var(--color-text-primary);
          }
        }

        &--primary {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #fff;
          &:hover:not([disabled]) {
            opacity: 0.88;
          }
          &[disabled] {
            opacity: 0.45;
            cursor: not-allowed;
          }
        }
      }
    `,
  ],
})
export class UdiseExportDialog implements OnInit {
  @Input() preselectedYearId?: number;
  @Input() preselectedClassSectionId?: number;
  @Output() closed = new EventEmitter<void>();
  @Output() exported = new EventEmitter<void>();

  selectedYearId: number | null = null;
  selectedClassSectionId: number | null = null;

  academicYears = signal<AcademicYear[]>([]);
  classSections = signal<ClassSection[]>([]);
  preview = signal<UDISECompletenessReport | null>(null);
  previewLoading = signal(false);
  exporting = signal(false);

  readonly sheets = [
    {
      name: 'Instructions',
      icon: 'menu_book',
      color: 'info',
      desc: 'How-to guide, field code reference, official portal links',
    },
    {
      name: 'Student Data',
      icon: 'table_chart',
      color: 'primary',
      desc: 'Upload-ready GP + EP + SF data (SDMS bulk template format)',
    },
    {
      name: 'Code Reference',
      icon: 'code',
      color: 'success',
      desc: 'UDISE+ code book — gender, social category, religion, mother tongue',
    },
    {
      name: 'Completeness Summary',
      icon: 'analytics',
      color: 'warning',
      desc: 'Per-student UDISE score, missing fields, section breakdown',
    },
  ];

  constructor(
    private udiseService: StudentUdiseService,
    private academicsService: AcademicsService
  ) {}

  ngOnInit(): void {
    this.selectedYearId = this.preselectedYearId ?? null;
    this.selectedClassSectionId = this.preselectedClassSectionId ?? null;

    this.academicsService.getAcademicYears().subscribe({
      next: (res) => this.academicYears.set(res.years),
    });
    this.academicsService.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections),
    });

    this.loadPreview();
  }

  onFilterChange(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    this.previewLoading.set(true);
    const params: { academicYearId?: number; classSectionId?: number } = {};
    if (this.selectedYearId) params.academicYearId = this.selectedYearId;
    if (this.selectedClassSectionId) params.classSectionId = this.selectedClassSectionId;

    this.udiseService.getCompleteness(params).subscribe({
      next: (report) => {
        this.preview.set(report);
        this.previewLoading.set(false);
      },
      error: () => this.previewLoading.set(false),
    });
  }

  doExport(): void {
    this.exporting.set(true);
    const params: { academicYearId?: number; classSectionId?: number } = {};
    if (this.selectedYearId) params.academicYearId = this.selectedYearId;

    const obs = this.selectedClassSectionId
      ? this.udiseService.exportClassSectionExcel(
          this.selectedClassSectionId,
          this.selectedYearId ?? undefined
        )
      : this.udiseService.exportExcel(params);

    obs.subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const yearLabel = this.selectedYearId
          ? this.academicYears().find((y) => y.id === this.selectedYearId)?.name ?? ''
          : 'current';
        const csLabel = this.selectedClassSectionId
          ? this.classSections().find((cs) => cs.id === this.selectedClassSectionId)?.className +
            '-' +
            this.classSections().find((cs) => cs.id === this.selectedClassSectionId)?.sectionName
          : 'all';
        a.href = url;
        a.download = `UDISE_${yearLabel}_${csLabel}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
        this.exported.emit();
      },
      error: () => this.exporting.set(false),
    });
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.close();
    }
  }
}
