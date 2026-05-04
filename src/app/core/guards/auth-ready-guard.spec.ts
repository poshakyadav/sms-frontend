import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { authReadyGuard } from './auth-ready-guard';

describe('authReadyGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => authReadyGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
