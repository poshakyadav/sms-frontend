import { TestBed } from '@angular/core/testing';

import { BulkAvatarUploadService } from './bulk-avatar-upload.service';

describe('BulkAvatarUploadService', () => {
  let service: BulkAvatarUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BulkAvatarUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
