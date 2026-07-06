import { TestBed } from '@angular/core/testing';

import { SchoolLogoUploadService } from './school-logo-upload.service';

describe('SchoolLogoUploadService', () => {
  let service: SchoolLogoUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SchoolLogoUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
