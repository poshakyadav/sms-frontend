import { TestBed } from '@angular/core/testing';

import { FeedImageUploadService } from './feed-image-upload.service';

describe('FeedImageUploadService', () => {
  let service: FeedImageUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeedImageUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
