import { TestBed } from '@angular/core/testing';

import { Academics } from './academics';

describe('Academics', () => {
  let service: Academics;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Academics);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
