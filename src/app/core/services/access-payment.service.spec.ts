import { TestBed } from '@angular/core/testing';

import { AccessPaymentService } from './access-payment.service';

describe('AccessPaymentService', () => {
  let service: AccessPaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccessPaymentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
