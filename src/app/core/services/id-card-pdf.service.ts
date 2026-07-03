// src/app/core/services/id-card-pdf.service.ts

import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { snapdom } from '@zumer/snapdom';
import { IdCardData } from './id-card.service';

const PX_PER_INCH = 100;

const A4_WIDTH_IN = 8.27;
const A4_HEIGHT_IN = 11.69;
const SHEET_MARGIN_IN = 0.4;
const CARD_GAP_IN = 0.15;

// CR80 card, both possible orientations (see id-card-preview.component.scss)
const HORIZONTAL_WIDTH_IN = 3.375;
const HORIZONTAL_HEIGHT_IN = 2.125;
const VERTICAL_WIDTH_IN = 2.125;
const VERTICAL_HEIGHT_IN = 3.375;

// Raster + compression settings. Scale/quality kept the same as before —
// the win here isn't "capture at lower quality", it's "capture the same
// quality in a fraction of the time".
const CAPTURE_SCALE = 3; // ≈300 DPI, still professional print standard
const JPEG_QUALITY = 0.92;

// ─────────────────────────────────────────────────────────────────────────
// FALLBACK PIXEL — solid white, NOT transparent.
//
// This is handed to SnapDOM as `fallbackURL`: the image it substitutes in
// if an <img> element fails to load/inline during capture. JPEG has no
// alpha channel, so if that substitute (or any leftover transparent region)
// gets flattened during canvas.toDataURL('image/jpeg'), the browser fills
// transparent pixels with solid BLACK — not white, not the parent's CSS
// background. That's exactly what was silently replacing card photos/logos
// before IdCardPreviewComponent started pre-resolving them to data: URIs.
//
// Generated at runtime via canvas instead of hand-typed base64, so there's
// zero chance of a malformed literal — and it's guarded for SSR contexts
// where `document` doesn't exist (this module can still be imported there
// even though the PDF-export feature itself only ever runs in the browser).
// ─────────────────────────────────────────────────────────────────────────
function createSolidPixelDataUrl(color: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return canvas.toDataURL('image/png');
}

const FALLBACK_PIXEL = createSolidPixelDataUrl('#ffffff');

interface CapturedCard {
  dataUrl: string;
  widthIn: number;
  heightIn: number;
}

/** What the caller must supply for each chunk: render exactly these cards
 *  into the DOM (and only these), wait until they're fully paint-ready
 *  (images + QR codes settled), and hand back their root elements plus an
 *  optional cleanup hook. */
export type ChunkRenderer = (
  chunk: IdCardData[]
) => Promise<{ elements: HTMLElement[]; cleanup: () => void }>;

@Injectable({ providedIn: 'root' })
export class IdCardPdfService {

  private async captureCard(cardEl: HTMLElement): Promise<CapturedCard> {
    const widthIn = cardEl.offsetWidth / PX_PER_INCH;
    const heightIn = cardEl.offsetHeight / PX_PER_INCH;

    // SnapDOM clones cardEl internally and fetches/inlines any remaining
    // <img>s itself as part of the capture. By this point the photo and
    // school logo should already be data: URIs (see IdCardPreviewComponent
    // + ImageDataUrlService), so there's nothing left for it to fetch — the
    // options below are defense-in-depth, not the primary fix.
    const capture = await snapdom(cardEl, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      quality: JPEG_QUALITY,

      // Uncomment if a school's logo/photo host is ever NOT CORS-enabled —
      // SnapDOM will fall back to routing that specific asset through a
      // proxy instead of failing the whole capture:
      // useProxy: 'https://proxy.corsfix.com/?',

      // Belt-and-suspenders: IdCardPreviewComponent already resolves each
      // photo/logo to a data: URI (or swaps to the initials placeholder)
      // before capture even runs, so this should rarely trigger. But if
      // some future/unexpected remote <img> ever slips into this DOM and
      // fails right at capture time, fall back to an OPAQUE WHITE pixel —
      // never a transparent one, since JPEG export flattens transparency
      // to solid black (see FALLBACK_PIXEL comment above for the full
      // explanation — this is what was silently blacking out ID card
      // photos before that fix).
      fallbackURL: FALLBACK_PIXEL,

      // Flip on while diagnosing — logs the *actual* reason (CORS, 404,
      // timeout, etc.) SnapDOM couldn't inline a given asset:
      // debug: true,
    });
    const jpg = await capture.toJpg();

    return { dataUrl: jpg.src, widthIn, heightIn };
  }

  /**
   * Single-card export — page size set to exactly the card's physical
   * dimensions.
   */
  async exportSingleCard(cardEl: HTMLElement, fileName: string): Promise<void> {
    const { dataUrl, widthIn, heightIn } = await this.captureCard(cardEl);
    const orientation = widthIn >= heightIn ? 'landscape' : 'portrait';

    const pdf = new jsPDF({ orientation, unit: 'in', format: [widthIn, heightIn] });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, widthIn, heightIn);
    pdf.save(fileName);
  }

  /**
   * Bulk export — processes `cards` in small chunks so only `chunkSize`
   * cards are ever rendered in the DOM at once. With SnapDOM's raster cost
   * now negligible, the per-chunk cost is dominated by Angular render +
   * network fetch of each card's unique photo (deduped/cached by
   * ImageDataUrlService), not rasterization — so `chunkSize` can safely be
   * larger than it needed to be under html2canvas (see PRINT_CHUNK_SIZE in
   * id-card-management.component.ts).
   */
  async exportBulkCardsChunked(
    cards: IdCardData[],
    chunkSize: number,
    renderChunk: ChunkRenderer,
    fileName: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    if (cards.length === 0) return;

    const hasVertical = cards.some(
      (c) => c.template.layoutConfig.orientation === 'vertical'
    );
    const hasHorizontal = cards.some(
      (c) => (c.template.layoutConfig.orientation ?? 'horizontal') === 'horizontal'
    );

    let slotWidthIn: number;
    let slotHeightIn: number;
    if (hasVertical && hasHorizontal) {
      slotWidthIn = HORIZONTAL_WIDTH_IN;
      slotHeightIn = VERTICAL_HEIGHT_IN;
    } else if (hasVertical) {
      slotWidthIn = VERTICAL_WIDTH_IN;
      slotHeightIn = VERTICAL_HEIGHT_IN;
    } else {
      slotWidthIn = HORIZONTAL_WIDTH_IN;
      slotHeightIn = HORIZONTAL_HEIGHT_IN;
    }

    const usableWidth = A4_WIDTH_IN - 2 * SHEET_MARGIN_IN;
    const usableHeight = A4_HEIGHT_IN - 2 * SHEET_MARGIN_IN;

    const cardsPerRow = Math.max(
      1,
      Math.floor((usableWidth + CARD_GAP_IN) / (slotWidthIn + CARD_GAP_IN))
    );
    const cardsPerCol = Math.max(
      1,
      Math.floor((usableHeight + CARD_GAP_IN) / (slotHeightIn + CARD_GAP_IN))
    );
    const cardsPerSheet = cardsPerRow * cardsPerCol;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'a4' });

    let index = 0;
    for (let start = 0; start < cards.length; start += chunkSize) {
      const chunk = cards.slice(start, start + chunkSize);

      const { elements, cleanup } = await renderChunk(chunk);

      for (const el of elements) {
        const captured = await this.captureCard(el);

        const positionOnSheet = index % cardsPerSheet;
        if (index > 0 && positionOnSheet === 0) pdf.addPage();

        const row = Math.floor(positionOnSheet / cardsPerRow);
        const col = positionOnSheet % cardsPerRow;
        const slotX = SHEET_MARGIN_IN + col * (slotWidthIn + CARD_GAP_IN);
        const slotY = SHEET_MARGIN_IN + row * (slotHeightIn + CARD_GAP_IN);
        const x = slotX + (slotWidthIn - captured.widthIn) / 2;
        const y = slotY + (slotHeightIn - captured.heightIn) / 2;

        pdf.addImage(captured.dataUrl, 'JPEG', x, y, captured.widthIn, captured.heightIn);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.005);
        pdf.rect(x, y, captured.widthIn, captured.heightIn);

        index++;
        onProgress?.(index, cards.length);
      }

      cleanup();

      // Still yield between chunks — lets Angular actually remove the old
      // DOM nodes and keeps the tab from ever being flagged "Unresponsive".
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    pdf.save(fileName);
  }
}