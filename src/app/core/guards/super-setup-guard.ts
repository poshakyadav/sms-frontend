import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * setupPageGuard — guards the /super/setup route.
 *
 * Allows access ONLY if:
 *   1. The user is NOT already authenticated as super, AND
 *   2. The backend confirms setup is still required (no super users exist).
 *
 * If setup is already done → redirect to /super/login.
 * If already authenticated → redirect to /super/dashboard.
 */
export const setupPageGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Already logged in as super admin
  if (auth.isAuthenticated() && auth.userType() === 'super') {
    router.navigate(['/super/dashboard']);
    return false;
  }

  return auth.checkSetupRequired().pipe(
    map((res) => {
      if (res.setupRequired) {
        return true;
      }
      // Setup is done — this page no longer exists
      router.navigate(['/super/login']);
      return false;
    }),
    catchError(() => {
      // If we can't reach the server, deny access gracefully
      router.navigate(['/super/login']);
      return of(false);
    })
  );
};
