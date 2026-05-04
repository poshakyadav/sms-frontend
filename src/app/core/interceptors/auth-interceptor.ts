// src/app/core/interceptors/auth-interceptor.ts
// Passes X-Active-Child-Id header automatically for parent-facing API calls

import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ParentService } from '../services/parent.service';
import { isPlatformBrowser } from '@angular/common';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const parentService = inject(ParentService);

  const platformId = inject(PLATFORM_ID);

  // ── SSR guard: never attempt token attachment on the server ─────────────
  // On the server there is no localStorage, so getAccessToken() returns null
  // and the request goes out unauthenticated. That unauthenticated response
  // then gets transfer-cached and re-used in the browser, making it look like
  // every authenticated request returns empty data.
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  // ── Build headers ────────────────────────────────────────────────────────
  const token = auth.getAccessToken();
  let authReq = req;

  if (token) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    // School requests need X-School-Code header (required for refresh endpoint)
    const schoolCode = auth.getSchoolCode();
    if (schoolCode && req.url.includes('school/')) {
      headers['X-School-Code'] = schoolCode;
    }

    // Pass X-Active-Child-Id for parent-facing API calls.
    // This allows the backend to scope data to the currently selected child
    // without requiring the parent to pass studentId in every request body.
    // Only attached when:
    //   1. The user role is STUDENT_PARENT
    //   2. There is an active child selected
    //   3. The request is to a school endpoint
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

    authReq = req.clone({ setHeaders: headers });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // ── 401: Token expired → attempt refresh ──────────────────────────
      if (
        error.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh')
      ) {
        return auth.refresh().pipe(
          switchMap((refreshRes: any) => {
            const newToken = refreshRes.access_token ?? auth.getAccessToken();
            const schoolCode = auth.getSchoolCode();
            const activeChildId = parentService.activeChildId();

            const retryHeaders: Record<string, string> = {
              Authorization: `Bearer ${newToken}`,
            };

            if (schoolCode && req.url.includes('school/')) {
              retryHeaders['X-School-Code'] = schoolCode;
            }

            if (
              auth.userRole() === 'STUDENT_PARENT' &&
              req.url.includes('school/') &&
              !req.url.includes('/auth/') &&
              activeChildId !== null
            ) {
              retryHeaders['X-Active-Child-Id'] = String(activeChildId);
            }

            const retryReq = req.clone({ setHeaders: retryHeaders });
            return next(retryReq);
          }),
          catchError((refreshErr) => throwError(() => refreshErr))
        );
      }

      return throwError(() => error);
    })
  );
};
