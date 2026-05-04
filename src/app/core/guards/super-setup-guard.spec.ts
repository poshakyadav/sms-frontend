import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { superSetupGuard } from './super-setup-guard';

describe('superSetupGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => superSetupGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
