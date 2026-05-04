import { TestBed } from '@angular/core/testing';

import { BulkUploadService } from './bulk-upload.service';

describe('BulkUploadService', () => {
  let service: BulkUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BulkUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
