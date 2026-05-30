import { TestBed } from '@angular/core/testing';

import { StudentHistoryService } from './student-history.service';

describe('StudentHistoryService', () => {
  let service: StudentHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StudentHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
