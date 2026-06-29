import { TestBed } from '@angular/core/testing';

import { IdCardPdfService } from './id-card-pdf.service';

describe('IdCardPdfService', () => {
  let service: IdCardPdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IdCardPdfService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
