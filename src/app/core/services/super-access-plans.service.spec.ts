import { TestBed } from '@angular/core/testing';

import { SuperAccessPlansService } from './super-access-plans.service';

describe('SuperAccessPlansService', () => {
  let service: SuperAccessPlansService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SuperAccessPlansService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
