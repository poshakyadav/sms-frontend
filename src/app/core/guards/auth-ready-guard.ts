import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authReadyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  auth.ensureInitialised();
  return true; 
};
