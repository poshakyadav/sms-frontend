// src/app/core/services/id-card-pdf.service.ts
//
// npm install jspdf html2canvas
//
// All PDF generation happens entirely in the browser. The backend never
// touches rendering — it only ever returns IdCardData JSON. This service
// takes already-rendered DOM nodes (the IdCardPreviewComponent's root
// element, one per card) and rasterizes + assembles them into a PDF.

import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── CR80 card size constants ─────────────────────────────────────────────────
// Real-world standard ID card size: 3.375in x 2.125in (85.6mm x 54mm).
// jsPDF works in whatever unit you configure — using 'in' here keeps the
// math directly traceable to the physical card spec.
const CARD_WIDTH_IN = 3.375;
const CARD_HEIGHT_IN = 2.125;

// A4 sheet size in inches, with a printable margin so cards aren't flush to
// the page edge (most home/office printers can't print true edge-to-edge,
// and a margin makes the cut lines easier to follow when trimming with
// scissors or a guillotine cutter).
const A4_WIDTH_IN = 8.27;
const A4_HEIGHT_IN = 11.69;
const SHEET_MARGIN_IN = 0.4;
const CARD_GAP_IN = 0.15;

@Injectable({ providedIn: 'root' })
export class IdCardPdfService {
  /**
   * Captures a single card DOM node to a high-resolution canvas.
   *
   * scale: 4 → since the on-screen preview is rendered at ~100 CSS px/inch
   * (337.5px x 212.5px for a CR80 card — see id-card-preview.component.ts),
   * a capture scale of 4 yields an effective ~400 DPI raster, comfortably
   * above the 300 DPI standard needed for crisp print output, including
   * the QR code, which is the most scan-sensitivity-critical element.
   */
  private async captureCard(cardEl: HTMLElement): Promise<string> {
    const canvas = await html2canvas(cardEl, {
      scale: 4,
      useCORS: true, // school logos / photos may be served from R2/CDN
      backgroundColor: '#ffffff',
      logging: false,
    });
    return canvas.toDataURL('image/png');
  }

  /**
   * Exports ONE card as a standalone PDF, with the PAGE SIZE set to exactly
   * the card's physical dimensions (no A4 wrapper, no extra whitespace).
   * This is the correct approach for single-card reprints where the school
   * is using a dedicated card printer/laminator rather than a standard
   * office printer.
   */
  async exportSingleCard(cardEl: HTMLElement, fileName: string): Promise<void> {
    const imageData = await this.captureCard(cardEl);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: [CARD_WIDTH_IN, CARD_HEIGHT_IN],
    });

    pdf.addImage(imageData, 'PNG', 0, 0, CARD_WIDTH_IN, CARD_HEIGHT_IN);
    pdf.save(fileName);
  }

  /**
   * Exports MULTIPLE cards as an A4 batch-print sheet, laid out in a grid
   * with cut-guide-friendly spacing. This is the standard "print on office
   * printer, cut with scissors/guillotine, laminate" workflow used by most
   * schools that don't own a dedicated card printer.
   *
   * Computes how many cards fit per row/column given CARD size + GAP, then
   * paginates automatically once a sheet is full.
   */
  async exportBulkCards(cardEls: HTMLElement[], fileName: string): Promise<void> {
    if (cardEls.length === 0) return;

    const usableWidth = A4_WIDTH_IN - 2 * SHEET_MARGIN_IN;
    const usableHeight = A4_HEIGHT_IN - 2 * SHEET_MARGIN_IN;

    const cardsPerRow = Math.max(
      1,
      Math.floor((usableWidth + CARD_GAP_IN) / (CARD_WIDTH_IN + CARD_GAP_IN))
    );
    const cardsPerCol = Math.max(
      1,
      Math.floor((usableHeight + CARD_GAP_IN) / (CARD_HEIGHT_IN + CARD_GAP_IN))
    );
    const cardsPerSheet = cardsPerRow * cardsPerCol;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'a4',
    });

    // Capture all cards up front (sequentially, to avoid spiking memory with
    // N simultaneous html2canvas renders for large batches).
    const images: string[] = [];
    for (const el of cardEls) {
      images.push(await this.captureCard(el));
    }

    images.forEach((imageData, index) => {
      const positionOnSheet = index % cardsPerSheet;

      if (index > 0 && positionOnSheet === 0) {
        pdf.addPage();
      }

      const row = Math.floor(positionOnSheet / cardsPerRow);
      const col = positionOnSheet % cardsPerRow;

      const x = SHEET_MARGIN_IN + col * (CARD_WIDTH_IN + CARD_GAP_IN);
      const y = SHEET_MARGIN_IN + row * (CARD_HEIGHT_IN + CARD_GAP_IN);

      pdf.addImage(imageData, 'PNG', x, y, CARD_WIDTH_IN, CARD_HEIGHT_IN);

      // Light cut-guide border around each card — helps with manual
      // trimming after printing. Drawn in a faint gray so it doesn't show
      // as a visible border once cut and laminated.
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.005);
      pdf.rect(x, y, CARD_WIDTH_IN, CARD_HEIGHT_IN);
    });

    pdf.save(fileName);
  }
}
