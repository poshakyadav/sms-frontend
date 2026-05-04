import { TestBed } from '@angular/core/testing';

import { Fees } from './fees';

describe('Fees', () => {
  let service: Fees;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Fees);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
