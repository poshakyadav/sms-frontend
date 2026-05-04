import { TestBed } from '@angular/core/testing';

import { Assignments } from './assignments';

describe('Assignments', () => {
  let service: Assignments;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Assignments);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
