import { TestBed } from '@angular/core/testing';

import { StudentUdiseService } from './student-udise.service';

describe('StudentUdiseService', () => {
  let service: StudentUdiseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StudentUdiseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
