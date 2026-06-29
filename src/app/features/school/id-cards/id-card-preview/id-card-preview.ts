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
  Input,
  OnChanges,
  OnInit,
  ViewChild,
  ElementRef,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdCardData } from '../../../../core/services/id-card.service';
import { QrCodeService } from '../../../../core/services/qr-code.service';

// ── Field label mapping ──────────────────────────────────────────────────────
// Maps the layoutConfig.visibleFields keys (raw snapshot field names) to
// human-readable labels shown on the card. Centralized here so template
// configs only ever need to store the field KEY, not display strings.
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

@Component({
  selector: 'app-id-card-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './id-card-preview.html',
  styleUrl: './id-card-preview.scss',
})
export class IdCardPreviewComponent implements OnInit, OnChanges {
  @Input({ required: true }) card!: IdCardData;

  @ViewChild('cardRoot') cardRootRef!: ElementRef<HTMLElement>;

  qrDataUrl: string | null = null;
  fieldLabels = FIELD_LABELS;

  constructor(private qrCodeService: QrCodeService) {}

  ngOnInit(): void {
    this.generateQr();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['card'] && !changes['card'].firstChange) {
      this.generateQr();
    }
  }

  private async generateQr(): Promise<void> {
    if (!this.card?.verificationUrl) return;
    this.qrDataUrl = await this.qrCodeService.toDataUrl(this.card.verificationUrl, 256);
  }

  /** Returns the human display value for a given snapshot field key. */
  getFieldValue(key: string): string | undefined {
    return (this.card.details as Record<string, string | undefined>)[key];
  }

  /** Visible fields filtered to only those that actually have a value for
   *  this holder (e.g. a staff card template might list "department" but
   *  this particular staff member has none recorded — skip it cleanly
   *  rather than showing an empty row). */
  get displayFields(): Array<{ key: string; label: string; value: string }> {
    return this.card.template.layoutConfig.visibleFields
      .map((key) => ({ key, label: this.fieldLabels[key] ?? key, value: this.getFieldValue(key) }))
      .filter((f): f is { key: string; label: string; value: string } => !!f.value);
  }

  get formattedValidUntil(): string {
    const d = new Date(this.card.validUntil);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
  }

  get roleLine(): string {
    if (this.card.holderType === 'STUDENT') {
      const { className, sectionName, rollNumber } = this.card.details;
      const classSection =
        className && sectionName ? `${className} - ${sectionName}` : className || '';
      return rollNumber ? `${classSection} | Roll No. ${rollNumber}` : classSection;
    }
    return this.card.details.designation || 'Staff';
  }

  /** Exposes the captured root element to parent components/services that
   *  need to pass it to IdCardPdfService (single export or batch capture). */
  getCardElement(): HTMLElement {
    return this.cardRootRef.nativeElement;
  }
}
