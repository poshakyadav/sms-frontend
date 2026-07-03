import { TestBed } from '@angular/core/testing';

import { MessageBundlesService } from './message-bundles.service';

describe('MessageBundlesService', () => {
  let service: MessageBundlesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MessageBundlesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
