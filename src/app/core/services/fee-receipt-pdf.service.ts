// core/services/fee-receipt-pdf.service.ts
import { Injectable } from '@angular/core';
import { snapdom } from '@zumer/snapdom';
import { jsPDF } from 'jspdf';

export type ReceiptPageSize = 'a5' | 'a4';

@Injectable({ providedIn: 'root' })
export class FeeReceiptPdfService {
  /**
   * Captures the receipt DOM node via snapdom and lays it into a jsPDF
   * document sized to fit the capture (page height driven by content, so a
   * short receipt doesn't get a mostly-blank A4 sheet). Mirrors your
   * ID-card export pipeline: snapdom @ high scale → canvas → addImage.
   */
  private async buildPdf(el: HTMLElement, pageSize: ReceiptPageSize): Promise<jsPDF> {
    const capture = await snapdom(el, { scale: 4, backgroundColor: '#ffffff' });
    const canvas = await capture.toCanvas();

    const pageWidths: Record<ReceiptPageSize, number> = { a5: 148, a4: 210 }; // mm
    const pageWidth = pageWidths[pageSize];

    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    const pageHeight = imgHeight + margin * 2;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageWidth, pageHeight],
    });

    doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, imgHeight);
    return doc;
  }

  /**
   * Opens the receipt in a new tab with the browser's print dialog primed.
   *
   * IMPORTANT: `window.open()` after an `await` gets silently blocked as a
   * popup in most browsers. To stay safe, callers that trigger this from an
   * indirect flow (e.g. "print automatically once this dialog opens") must
   * open the tab THEMSELVES synchronously on the original click and pass it
   * in as `existingWindow`. Callers triggering this directly from a click
   * (e.g. a "Print" button inside the receipt dialog) can omit it — this
   * method opens its own window in that case, which is still safe because
   * it happens synchronously as the first statement below.
   */
  async print(
    el: HTMLElement,
    filename: string,
    pageSize: ReceiptPageSize = 'a5',
    existingWindow?: Window | null
  ): Promise<void> {
    const printWindow = existingWindow !== undefined ? existingWindow : window.open('', '_blank');

    const doc = await this.buildPdf(el, pageSize);
    doc.autoPrint();
    const blobUrl = doc.output('bloburl') as unknown as string;

    if (printWindow) {
      printWindow.location.href = blobUrl;
    } else {
      // Popup blocked despite the synchronous attempt — fall back to a
      // direct download so the action isn't a silent no-op.
      doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    }
  }

  async download(
    el: HTMLElement,
    filename: string,
    pageSize: ReceiptPageSize = 'a5'
  ): Promise<void> {
    const doc = await this.buildPdf(el, pageSize);
    doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  }
}