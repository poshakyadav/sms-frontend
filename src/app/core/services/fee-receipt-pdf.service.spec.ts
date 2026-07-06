import { TestBed } from '@angular/core/testing';

import { FeeReceiptPdfService } from './fee-receipt-pdf.service';

describe('FeeReceiptPdfService', () => {
  let service: FeeReceiptPdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeeReceiptPdfService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
