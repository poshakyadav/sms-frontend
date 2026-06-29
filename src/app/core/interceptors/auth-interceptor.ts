// src/app/core/interceptors/auth-interceptor.ts

import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpEventType,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { catchError, filter, switchMap, take, throwError, BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ParentService } from '../services/parent.service';
import { isPlatformBrowser } from '@angular/common';
import { BillingService } from '../services/billing.service';
import { Router } from '@angular/router';

// ── Module-level refresh state (shared across all interceptor invocations) ───
// These MUST be outside the function so all concurrent requests share the same
// queue. If declared inside the fn, each request gets its own copy.
let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

// ── Helper: build headers object ─────────────────────────────────────────────
function buildHeaders(
  token: string,
  req: HttpRequest<unknown>,
  auth: AuthService,
  parentService: ParentService
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const schoolCode = auth.getSchoolCode();
  if (schoolCode && req.url.includes('school/')) {
    headers['X-School-Code'] = schoolCode;
  }

  if (
    auth.userRole() === 'STUDENT_PARENT' &&
    req.url.includes('school/') &&
    !req.url.includes('/auth/')
  ) {
    const activeChildId = parentService.activeChildId();
    if (activeChildId !== null) {
      headers['X-Active-Child-Id'] = String(activeChildId);
    }
  }

  return headers;
}

// ── Helper: clone request with new token ─────────────────────────────────────
function addToken(
  req: HttpRequest<unknown>,
  token: string,
  auth: AuthService,
  parentService: ParentService
): HttpRequest<unknown> {
  return req.clone({
    setHeaders: buildHeaders(token, req, auth, parentService),
  });
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const parentService = inject(ParentService);
  const billing = inject(BillingService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // ── SSR guard ────────────────────────────────────────────────────────────
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  // ── Attach token to outgoing request ─────────────────────────────────────
  const token = auth.getAccessToken();
  const authReq = token ? addToken(req, token, auth, parentService) : req;

  return next(authReq).pipe(
    // ── Capture the "renew soon" header on ANY successful response ─────────
    tap((event) => {
      if (event.type === HttpEventType.Response) {
        const daysHeader = event.headers.get('X-Access-Expires-In-Days');
        if (daysHeader !== null) {
          const days = parseInt(daysHeader, 10);
          if (!isNaN(days)) billing.setExpiresInDaysFromHeader(days);
        }
      }
    }),

    catchError((error: HttpErrorResponse) => {
      // ── Access expired (402) — not an auth problem, don't try to refresh.
      // Redirect straight to the renewal page instead.
      if (error.status === 402 && error.error?.code === 'ACCESS_EXPIRED') {
        if (!router.url.startsWith('/school/billing')) {
          router.navigate(['/school/billing/plans'], { queryParams: { expired: 'true' } });
        }
        return throwError(() => error);
      }

      // ── Only handle 401s, and never for auth endpoints ───────────────────
      if (
        error.status !== 401 ||
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/refresh')
      ) {
        return throwError(() => error);
      }

      return handle401(req, next, auth, parentService);
    })
  );
};

// ── Core refresh + retry logic ───────────────────────────────────────────────
function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  parentService: ParentService
): Observable<any> {
  if (isRefreshing) {
    // ── Queue: wait for the in-progress refresh to complete, then retry ────
    // filter(Boolean) skips the initial null and the null emitted when refresh
    // starts, so queued requests only unblock once a real token arrives.
    return refreshToken$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((newToken) => next(addToken(req, newToken, auth, parentService)))
    );
  }

  // ── This request is the first 401 — start the refresh ───────────────────
  isRefreshing = true;
  refreshToken$.next(null); // signal "refresh in progress" to queued requests

  return auth.refresh().pipe(
    switchMap((res: any) => {
      isRefreshing = false;
      const newToken = res.access_token ?? auth.getAccessToken()!;
      refreshToken$.next(newToken); // unblock all queued requests
      return next(addToken(req, newToken, auth, parentService));
    }),
    catchError((refreshErr) => {
      // ── Refresh failed: reset state, logout immediately ──────────────────
      // auth.logout() navigates to /login, so the user never sees a broken page.
      isRefreshing = false;
      refreshToken$.next(null);
      auth.logout(); // clears localStorage + navigates to /login
      return throwError(() => refreshErr);
    })
  );
}
