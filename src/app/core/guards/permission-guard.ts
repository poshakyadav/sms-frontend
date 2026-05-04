import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

// ── Helper: check auth from signal OR localStorage (refresh-safe) ─────────────
function isAuthenticatedSafe(auth: AuthService): boolean {
  // Signal is the source of truth when hydrated
  if (auth.isAuthenticated()) return true;
  // Fallback: check localStorage directly (in case signal hasn't run yet)
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const userType = typeof window !== 'undefined' ? localStorage.getItem('userType') : null;
  return !!(token && userType);
}

function getUserTypeSafe(auth: AuthService): string | null {
  const fromSignal = auth.userType();
  if (fromSignal) return fromSignal;
  return typeof window !== 'undefined' ? localStorage.getItem('userType') : null;
}

// ── Read permissions from signal OR localStorage fallback ────────────────
function getPermissionsSafe(auth: AuthService): string[] {
  const fromSignal = auth.permissions();
  if (fromSignal.length > 0) return fromSignal;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('permissions') : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getSuperPermissionsSafe(auth: AuthService): string[] {
  const fromSignal = auth.superPermissions();
  if (fromSignal.length > 0) return fromSignal;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('superPermissions') : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Permission check using safe getters ──────────────────────────────────────
function hasAnyPermissionSafe(auth: AuthService, slugs: string[]): boolean {
  const perms = getPermissionsSafe(auth);
  return slugs.some((s) => perms.includes('*') || perms.includes(s));
}

function hasAnySuperPermissionSafe(auth: AuthService, slugs: string[]): boolean {
  const perms = getSuperPermissionsSafe(auth);
  return slugs.some((s) => perms.includes('*') || perms.includes(s));
}

// ── School PBAC guard ─────────────────────────────────────────────────────────

export function permissionGuard(required: string | string[]): CanActivateFn {
  return (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!isAuthenticatedSafe(auth)) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    if (getUserTypeSafe(auth) !== 'school') {
      router.navigate(['/unauthorized']);
      return false;
    }

    const slugs = Array.isArray(required) ? required : [required];
    if (!hasAnyPermissionSafe(auth, slugs)) {
      router.navigate(['/unauthorized']);
      return false;
    }
    return true;
  };
}

// ── Super PBAC guard  ← replaces roleGuard ───────────────────────────────────

/**
 * Usage:  canActivate: [superPermissionGuard('dashboard.view')]
 *         canActivate: [superPermissionGuard(['users.list', 'schools.manage'])]  // ANY
 *
 * SUPERADMIN has wildcard "*" so they always pass.
 */
export function superPermissionGuard(required: string | string[]): CanActivateFn {
  return (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!isAuthenticatedSafe(auth)) {
      router.navigate(['/super/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    if (getUserTypeSafe(auth) !== 'super') {
      router.navigate(['/unauthorized']);
      return false;
    }

    const slugs = Array.isArray(required) ? required : [required];
    if (!hasAnySuperPermissionSafe(auth, slugs)) {
      router.navigate(['/unauthorized']);
      return false;
    }
    return true;
  };
}

// ── Generic auth guard ────────────────────────────────────────────────────────

export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!isAuthenticatedSafe(auth)) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  return true;
};


// ── Super auth guard (just checks userType) ───────────────────────────────────

export const superAuthGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!isAuthenticatedSafe(auth)) {
    router.navigate(['/super/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  if (getUserTypeSafe(auth) !== 'super') {
    router.navigate(['/unauthorized']);
    return false;
  }
  return true;
};

// ── School auth guard ─────────────────────────────────────────────────────────

export const schoolAuthGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!isAuthenticatedSafe(auth)) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  if (getUserTypeSafe(auth) !== 'school') {
    router.navigate(['/unauthorized']);
    return false;
  }
  return true;
};

// ── Login guard ───────────────────────────────────────────────────────────────

// Now: if already authenticated, redirect to returnUrl (the URL they were on)
// so a refresh → guard fail → /login → loginGuard cycle ends back at the
// original page, not dashboard.
export const loginGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!isAuthenticatedSafe(auth)) return true;

  // If an auth guard redirected here with returnUrl, go back to that URL.
  // This is what breaks the "always lands on dashboard" cycle.
  const returnUrl = route.queryParams['returnUrl'];
  if (returnUrl) {
    router.navigateByUrl(returnUrl);
    return false;
  }

  const dest = getUserTypeSafe(auth) === 'super' ? '/super/dashboard' : '/school/dashboard';
  router.navigate([dest]);
  return false;
};


