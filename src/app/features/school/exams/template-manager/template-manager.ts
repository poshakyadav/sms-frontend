import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import {
  CardTemplate,
  ExamsService,
  TemplateConfig,
  TemplateMeta,
} from '../../../../core/services/exams.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TemplatePreviewModal } from '../template-preview-modal/template-preview-modal';

type CardType = 'ADMIT_CARD' | 'REPORT_CARD';

interface TypeTab {
  key: CardType;
  label: string;
  icon: string;
  accentClass: string;
}

@Component({
  selector: 'app-template-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TemplatePreviewModal,
  ],
  templateUrl: './template-manager.html',
  styleUrl: './template-manager.scss',
})
export class TemplateManager implements OnInit {
  private examsService = inject(ExamsService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // ── State ────────────────────────────────────────────────────────────────
  activeType = signal<CardType>('ADMIT_CARD');
  loading = signal(true);
  saving = signal(false);

  admitConfig = signal<TemplateConfig | null>(null);
  reportConfig = signal<TemplateConfig | null>(null);

  // Staged selection (before save)
  stagedAdmitKey = signal<string>('');
  stagedReportKey = signal<string>('');

  // ── Preview State ────────────────────────────────────────────────────────
  previewTemplate = signal<CardTemplate | null>(null);
  previewCardType = signal<CardType>('ADMIT_CARD');
  previewLoading = signal<string | null>(null); // key of template being loaded

  // ── Computed ─────────────────────────────────────────────────────────────
  currentConfig = computed(() =>
    this.activeType() === 'ADMIT_CARD' ? this.admitConfig() : this.reportConfig()
  );

  currentStagedKey = computed(() =>
    this.activeType() === 'ADMIT_CARD' ? this.stagedAdmitKey() : this.stagedReportKey()
  );

  admitHasChanges = computed(() => {
    const cfg = this.admitConfig();
    return !!cfg && this.stagedAdmitKey() !== cfg.activeKey;
  });

  reportHasChanges = computed(() => {
    const cfg = this.reportConfig();
    return !!cfg && this.stagedReportKey() !== cfg.activeKey;
  });

  hasAnyChanges = computed(() => this.admitHasChanges() || this.reportHasChanges());

  // ── Type tabs ─────────────────────────────────────────────────────────────
  tabs: TypeTab[] = [
    { key: 'ADMIT_CARD', label: 'Admit Card', icon: 'badge', accentClass: 'admit' },
    { key: 'REPORT_CARD', label: 'Report Card', icon: 'summarize', accentClass: 'report' },
  ];

  ngOnInit(): void {
    this.loadBoth();
  }

  private loadBoth(): void {
    this.loading.set(true);

    let admitDone = false;
    let reportDone = false;

    const checkDone = () => {
      if (admitDone && reportDone) this.loading.set(false);
    };

    this.examsService.getTemplateConfig('ADMIT_CARD').subscribe({
      next: (cfg) => {
        this.admitConfig.set(cfg);
        this.stagedAdmitKey.set(cfg.activeKey);
        admitDone = true;
        checkDone();
      },
      error: () => {
        this.toast.error('Failed to load admit card templates');
        admitDone = true;
        checkDone();
      },
    });

    this.examsService.getTemplateConfig('REPORT_CARD').subscribe({
      next: (cfg) => {
        this.reportConfig.set(cfg);
        this.stagedReportKey.set(cfg.activeKey);
        reportDone = true;
        checkDone();
      },
      error: () => {
        this.toast.error('Failed to load report card templates');
        reportDone = true;
        checkDone();
      },
    });
  }

  setType(type: CardType): void {
    this.activeType.set(type);
  }

  selectTemplate(key: string): void {
    if (this.activeType() === 'ADMIT_CARD') {
      this.stagedAdmitKey.set(key);
    } else {
      this.stagedReportKey.set(key);
    }
  }

  isSelected(key: string): boolean {
    return this.currentStagedKey() === key;
  }

  isActive(key: string): boolean {
    return this.currentConfig()?.activeKey === key;
  }

  getThumbnailClass(thumbnail: string): string {
    return `thumb-${thumbnail}`;
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  /**
   * Opens the preview modal for a template.
   * Fetches the full template HTML from the backend (which has the real
   * htmlContent), then renders it with dummy data in the modal.
   */
  openPreview(tmpl: TemplateMeta, event: Event): void {
    event.stopPropagation(); // don't trigger selectTemplate on the card

    this.previewLoading.set(tmpl.key);
    const type = this.activeType();

    this.examsService.getTemplateHtml(type, tmpl.key).subscribe({
      next: (fullTemplate) => {
        this.previewLoading.set(null);
        this.previewCardType.set(type);
        this.previewTemplate.set(fullTemplate);
      },
      error: () => {
        this.previewLoading.set(null);
        this.toast.error('Failed to load template preview');
      },
    });
  }

  closePreview(): void {
    this.previewTemplate.set(null);
  }

  isPreviewLoading(key: string): boolean {
    return this.previewLoading() === key;
  }

  // ── Save / Discard ────────────────────────────────────────────────────────
  saveAll(): void {
    if (!this.hasAnyChanges()) return;
    this.saving.set(true);

    const tasks: Promise<void>[] = [];

    if (this.admitHasChanges()) {
      const key = this.stagedAdmitKey();
      const name = this.admitConfig()!.templates.find((t) => t.key === key)?.name ?? key;
      tasks.push(
        new Promise<void>((resolve, reject) => {
          this.examsService
            .selectTemplate({ type: 'ADMIT_CARD', templateKey: key, name })
            .subscribe({ next: () => resolve(), error: reject });
        })
      );
    }

    if (this.reportHasChanges()) {
      const key = this.stagedReportKey();
      const name = this.reportConfig()!.templates.find((t) => t.key === key)?.name ?? key;
      tasks.push(
        new Promise<void>((resolve, reject) => {
          this.examsService
            .selectTemplate({ type: 'REPORT_CARD', templateKey: key, name })
            .subscribe({ next: () => resolve(), error: reject });
        })
      );
    }

    Promise.all(tasks)
      .then(() => {
        this.toast.success('Templates saved successfully!');
        this.loadBoth();
      })
      .catch(() => {
        this.toast.error('Failed to save one or more templates');
      })
      .finally(() => this.saving.set(false));
  }

  discardChanges(): void {
    const admitCfg = this.admitConfig();
    const reportCfg = this.reportConfig();
    if (admitCfg) this.stagedAdmitKey.set(admitCfg.activeKey);
    if (reportCfg) this.stagedReportKey.set(reportCfg.activeKey);
  }

  goBack(): void {
    this.router.navigate(['/school/exams/list']);
  }
}
