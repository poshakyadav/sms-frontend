import { TestBed } from '@angular/core/testing';

import { FeeReceiptService } from './fee-receipt.service';

describe('FeeReceiptService', () => {
  let service: FeeReceiptService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeeReceiptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
