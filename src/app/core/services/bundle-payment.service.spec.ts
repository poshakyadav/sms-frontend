import { TestBed } from '@angular/core/testing';

import { BundlePaymentService } from './bundle-payment.service';

describe('BundlePaymentService', () => {
  let service: BundlePaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BundlePaymentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
