import { TestBed } from '@angular/core/testing';

import { IdCardService } from './id-card.service';

describe('IdCardService', () => {
  let service: IdCardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IdCardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
