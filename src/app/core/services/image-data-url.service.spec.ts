import { TestBed } from '@angular/core/testing';

import { ImageDataUrlService } from './image-data-url.service';

describe('ImageDataUrlService', () => {
  let service: ImageDataUrlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageDataUrlService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
