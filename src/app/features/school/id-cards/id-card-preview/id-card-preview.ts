// src/app/features/school/id-cards/id-card-preview/id-card-preview.component.ts
//
// Pure presentational component. Renders ONE card face (front-only, per
// the product decision) at a fixed CR80 aspect ratio. This exact DOM node
// (via #cardRoot) is what IdCardPdfService.captureCard() rasterizes — so
// its dimensions and styling must be self-contained and must not rely on
// any ambient page CSS that could differ between the live admin screen and
// an off-screen render used purely for bulk PDF export.

import {
  Component,
  computed,
  inject,
  input,
  viewChild,
  signal,
  effect,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdCardData, IdCardHolderType } from '../../../../core/services/id-card.service';
import { QrCodeService } from '../../../../core/services/qr-code.service';
import { ImageDataUrlService } from '../../../../core/services/image-data-url.service';

// ── Field label mapping ──────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  className: 'Class',
  sectionName: 'Section',
  rollNumber: 'Roll No.',
  admissionNumber: 'Admission No.',
  designation: 'Designation',
  department: 'Department',
  employeeCode: 'Employee Code',
  bloodGroup: 'Blood Group',
  dateOfBirth: 'DOB',
};

// ── Holder-type badge label ──────────────────────────────────────────────────
const HOLDER_TYPE_LABELS: Record<IdCardHolderType, string> = {
  STUDENT: 'STUDENT ID',
  STAFF: 'STAFF ID',
};

@Component({
  selector: 'app-id-card-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './id-card-preview.html',
  styleUrl: './id-card-preview.scss',
})
export class IdCardPreviewComponent {
  card = input.required<IdCardData>();

  private cardRootRef = viewChild.required<ElementRef<HTMLElement>>('cardRoot');
  private qrCodeService = inject(QrCodeService);

  private imageDataUrlService = inject(ImageDataUrlService);

  fieldLabels = FIELD_LABELS;

  // ── QR code ──────────────────────────────────────────────────────────────
  qrDataUrl = signal<string | null | undefined>(undefined);
  private qrReadyResolve!: () => void;
  private qrReadyPromise = new Promise<void>((resolve) => { this.qrReadyResolve = resolve; });

  // ── Photo — resolved to a data: URI. This is the actual fix for the
  // black-box-on-print bug. See ImageDataUrlService. ────────────────────────
  photoDataUrl = signal<string | null>(null);
  photoLoadFailed = signal(false);
  private photoReadyResolve!: () => void;
  private photoReadyPromise = new Promise<void>((resolve) => { this.photoReadyResolve = resolve; });

  // ── School logo — same treatment, same failure mode as the photo ─────────
  logoDataUrl = signal<string | null>(null);
  private logoReadyResolve!: () => void;
  private logoReadyPromise = new Promise<void>((resolve) => { this.logoReadyResolve = resolve; });


  constructor() {
    effect(() => {
      const url = this.card().verificationUrl;
      if (!url) {
        this.qrDataUrl.set(null);
        this.qrReadyResolve();
        return;
      }
      this.qrCodeService
        .toDataUrl(url, 256)
        .then((dataUrl) => this.qrDataUrl.set(dataUrl))
        .catch((err) => {
          console.error('[ID-CARD] QR generation failed for', this.card().cardNumber, err);
          this.qrDataUrl.set(null);
        })
        .finally(() => this.qrReadyResolve());
    });

    effect(() => {
      const url = this.card().photoUrl;
      if (!url) {
        this.photoDataUrl.set(null);
        this.photoLoadFailed.set(false);
        this.photoReadyResolve();
        return;
      }
      this.imageDataUrlService
        .resolve(url)
        .then((dataUrl) => {
          this.photoDataUrl.set(dataUrl);
          this.photoLoadFailed.set(dataUrl === null);
        })
        .finally(() => this.photoReadyResolve());
    });

    effect(() => {
      const url = this.card().school.logoUrl;
      if (!url) {
        this.logoDataUrl.set(null);
        this.logoReadyResolve();
        return;
      }
      this.imageDataUrlService
        .resolve(url)
        .then((dataUrl) => this.logoDataUrl.set(dataUrl))
        .finally(() => this.logoReadyResolve());
    });
  }

  /** Print/export flow waits on this — resolves once QR, photo, and logo
   *  have all settled, so nothing gets captured mid-flight or blank. */
  whenReady(): Promise<void> {
    return Promise.all([
      this.qrReadyPromise,
      this.photoReadyPromise,
      this.logoReadyPromise,
    ]).then(() => { });
  }

  getFieldValue(key: string): string | undefined {
    return (this.card().details as Record<string, string | undefined>)[key];
  }

  orientation = computed<'horizontal' | 'vertical'>(
    () => this.card().template.layoutConfig.orientation ?? 'horizontal'
  );

  cardTypeLabel = computed(
    () => HOLDER_TYPE_LABELS[this.card().holderType] ?? 'ID CARD'
  );

  displayFields = computed(() => {
    const card = this.card();
    return card.template.layoutConfig.visibleFields
      .map((key) => {
        const raw = (card.details as Record<string, string | undefined>)[key];
        return {
          key,
          label: this.fieldLabels[key] ?? key,
          value: raw ? this.formatFieldValue(key, raw) : raw,
        };
      })
      .filter((f): f is { key: string; label: string; value: string } => !!f.value);
  });

  private formatFieldValue(key: string, raw: string): string {
    if (key !== 'dateOfBirth') return raw;

    const trimmed = raw.trim();
    let date: Date;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      date = new Date(Date.UTC(1899, 11, 30) + Number(trimmed) * 86400000);
    } else {
      date = new Date(trimmed);
    }

    if (isNaN(date.getTime())) return raw;

    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fieldDensity = computed<'normal' | 'compact' | 'tight'>(() => {
    const count = this.displayFields().length;
    const rows = Math.ceil(count / 2);

    if (this.orientation() === 'vertical') {
      if (rows <= 1) return 'normal';
      if (rows <= 2) return 'compact';
      return 'tight';
    }

    if (rows <= 2) return 'normal';
    if (rows <= 3) return 'compact';
    return 'tight';
  });

  formattedValidUntil = computed(() => {
    const d = new Date(this.card().validUntil);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
  });

  roleLine = computed(() => {
    const card = this.card();
    if (card.holderType === 'STUDENT') {
      const { className, sectionName, rollNumber } = card.details;
      const classSection =
        className && sectionName ? `${className} - ${sectionName}` : className || '';
      return rollNumber ? `${classSection} | Roll No. ${rollNumber}` : classSection;
    }
    return card.details.designation || 'Staff';
  });

  getCardElement(): HTMLElement {
    return this.cardRootRef().nativeElement;
  }
}