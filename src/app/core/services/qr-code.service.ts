// src/app/core/services/qr-code.service.ts
//
// Thin wrapper around the `qrcode` npm package. Centralizing this means
// every QR code in the app (currently just ID cards, potentially other
// features later — e.g. fee receipt verification) uses the same error
// correction level and visual style, and there's exactly one place to
// change defaults.
//
// npm install qrcode
// npm install --save-dev @types/qrcode

import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';

@Injectable({ providedIn: 'root' })
export class QrCodeService {
  /**
   * Generates a QR code as a PNG data URL.
   *
   * errorCorrectionLevel: 'M' (15% recovery) is the standard industry choice
   * for printed ID cards — high enough to survive minor lamination glare /
   * surface scratches without needing the much denser 'H' level, which
   * would make the QR harder to scan at the small print size on a CR80 card.
   *
   * margin: 1 module — keeps the QR compact, since the card's own quiet
   * zone (whitespace padding in the layout) provides additional clearance.
   */
  async toDataUrl(text: string, pixelSize: number = 256): Promise<string> {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: pixelSize,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }
}
