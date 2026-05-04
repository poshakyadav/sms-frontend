// frontend auth.service.ts

import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, Observable, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { ThemeService } from './theme.service';
import { ParentService } from './parent.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserType = 'school' | 'super';

export interface SchoolUser {
  id: number;
  name: string;
  email: string;
  schoolCode: string;
}

export interface SuperUser {
  id: number;
  name: string;
}

// ── NEW: canonical shape stored in localStorage under 'schoolInfo' ────────────
// Used by SchoolHeader, school-info.service.ts tap, and school-info.component.ts.
// Keep this interface in sync with SchoolBranding in the backend routes file.
export interface SchoolBranding {
  name: string;
  shortName: string | null;
  code: string; // uniqueCode — kept for the header fallback
  addressLineOne: string;
  addressLineTwo: string;
  phone: string;
  alternatePhone: string;
  email: string;
  logoUrl: string | null;
  tagline: string | null;
  theme: {
    themeName: string;
    config: Record<string, string>;
    isCustomTheme: boolean;
  } | null;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  ACCESS_TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_TYPE: 'userType',
  SCHOOL_USER: 'schoolUser',
  SUPER_USER: 'superUser',
  PERMISSIONS: 'permissions',
  SCHOOL_CODE: 'schoolCode',
  SUPER_PERMS: 'superPermissions',
  USER_ROLE: 'userRole',
  SCHOOL_INFO: 'schoolInfo',
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private themeService = inject(ThemeService);

  // Use a lazy getter to avoid circular DI — ParentService depends on ApiService,
  // not on AuthService, so direct injection is safe here.
  private parentService = inject(ParentService);

  // ── Signals ─────────────────────────────────────────────────────────────────
  isAuthenticated = signal(false);
  userType = signal<UserType | null>(null);

  // School PBAC
  permissions = signal<string[]>([]);
  schoolCode = signal<string | null>(null);
  schoolUser = signal<SchoolUser | null>(null);

  // Super PBAC  ← replaces superRole
  superPermissions = signal<string[]>([]);
  superUser = signal<SuperUser | null>(null);

  // Role — kept as a signal so templates can react to child-switches etc.
  userRole = signal<string>('');

  // ── Refresh coordination ─────────────────────────────────────────────────────
  private isRefreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadAuthState();
    }
    this._initialised = true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHOOL PERMISSION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  hasPermission(slug: string): boolean {
    const p = this.permissions();
    return p.includes('*') || p.includes(slug);
  }

  hasAllPermissions(slugs: string[]): boolean {
    return slugs.every((s) => this.hasPermission(s));
  }

  hasAnyPermission(slugs: string[]): boolean {
    return slugs.some((s) => this.hasPermission(s));
  }

  isSchoolOwner(): boolean {
    return this.permissions().includes('*');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER PERMISSION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  hasSuperPermission(slug: string): boolean {
    const p = this.superPermissions();
    return p.includes('*') || p.includes(slug);
  }

  hasAnySuperPermission(slugs: string[]): boolean {
    return slugs.some((s) => this.hasSuperPermission(s));
  }

  isSuperAdmin(): boolean {
    return this.superPermissions().includes('*');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  // ===== super login ======
  superLogin(email: string, password: string): Observable<any> {
    return this.api.post('auth/login', { email, password }).pipe(
      tap((res: any) => this.saveSuperAuth(res)),
      catchError((err) => {
        this.toast.error('Login failed: ' + (err?.error?.error || 'Invalid credentials'));
        return throwError(() => err);
      })
    );
  }

  // ─── Super Forgot Password API ──────────────────────────────────────────────────────

  /**
   * Step 1 — Request a 6-digit OTP sent to the given email.
   * Always resolves (never throws) — backend returns a generic message
   * regardless of whether the email exists (prevents enumeration).
   */
  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('auth/forgot-password', { email });
  }

  /**
   * Step 2 — Verify the OTP.
   * On success, returns a short-lived resetSessionToken to use in step 3.
   */
  verifyResetOtp(email: string, otp: string): Observable<{ resetSessionToken: string }> {
    return this.api.post<{ resetSessionToken: string }>('auth/forgot-password/verify', {
      email,
      otp,
    });
  }

  /**
   * Step 3 — Submit new password with the session token from step 2.
   */
  resetPassword(
    resetSessionToken: string,
    newPassword: string,
    confirmPassword: string
  ): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('auth/forgot-password/reset', {
      resetSessionToken,
      newPassword,
      confirmPassword,
    });
  }

  // ---------------------------------

  // ─── Setup API ────────────────────────────────────────────────────────────────

  /**
   * Checks whether the one-time super-admin setup is still required.
   * Safe to call unauthenticated.
   */
  checkSetupRequired(): Observable<{ setupRequired: boolean }> {
    return this.api.get<{ setupRequired: boolean }>('auth/setup/status');
  }

  /**
   * Bootstraps the primary SUPERADMIN account.
   * The backend returns 404 if setup is already complete.
   */
  setupSuperAdmin(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Observable<any> {
    return this.api.post('auth/setup', data).pipe(
      tap((res: any) => this.saveSuperAuth(res)),
      catchError((err) => {
        return throwError(() => err);
      })
    );
  }

  // --------------------

  // ====== School login ======
  schoolLogin(
    schoolCode: string,
    email: string,
    password: string,
    termsAccepted?: boolean
  ): Observable<any> {
    const body: any = { schoolCode, email, password };
    if (termsAccepted !== undefined) body.termsAccepted = termsAccepted;

    return this.api.post('school/auth/login', body).pipe(
      tap((res: any) => {
        // Only save auth state on a genuine 2xx success response.
        // The 403 T&C gate never reaches here — it goes to catchError.
        if (res?.success) {
          this.saveSchoolAuth(res, schoolCode);
        }
      }),
      catchError((err) => {
        // FIX: Guard on the exact flag — never suppress toast for anything else.
        const isTermsGate = err?.error?.requiresTermsAcceptance === true;
        if (!isTermsGate) {
          this.toast.error(err?.error?.error || 'Invalid email or password');
        }
        // Re-throw the original HttpErrorResponse so the component's catch block
        // receives err.error (the parsed body) intact.
        return throwError(() => err);
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN REFRESH
  // ═══════════════════════════════════════════════════════════════════════════

  refresh(): Observable<any> {
    if (!isPlatformBrowser(this.platformId)) return throwError(() => 'SSR');

    const refreshToken = localStorage.getItem(KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

    if (this.isRefreshing) return this.refreshSubject.asObservable();

    this.isRefreshing = true;
    this.refreshSubject.next(null);

    const isSchool = this.userType() === 'school';
    const endpoint = isSchool ? 'school/auth/refresh' : 'auth/refresh';

    return this.api
      .post<{ access_token: string; refresh_token: string }>(endpoint, {
        refresh_token: refreshToken,
      })
      .pipe(
        tap((res: any) => {
          if (!isPlatformBrowser(this.platformId)) return;

          localStorage.setItem(KEYS.ACCESS_TOKEN, res.access_token);
          localStorage.setItem(KEYS.REFRESH_TOKEN, res.refresh_token);

          const decoded = this.decodeJwt(res.access_token);

          if (decoded?.permissions) {
            if (isSchool) {
              this.permissions.set(decoded.permissions);
              localStorage.setItem(KEYS.PERMISSIONS, JSON.stringify(decoded.permissions));
            } else {
              this.superPermissions.set(decoded.permissions);
              localStorage.setItem(KEYS.SUPER_PERMS, JSON.stringify(decoded.permissions));
            }
          }

          // ── also persist role from refreshed token ─────────────────
          // The original code never updated userRole on refresh, so if a page
          // reload triggered a token refresh before loadAuthState ran, the role
          // signal would be wrong until the next full page load.
          if (isSchool && decoded?.role) {
            this.userRole.set(decoded.role);
            localStorage.setItem(KEYS.USER_ROLE, decoded.role);
          }

          // ── NEW: update schoolInfo cache from refresh response ────────────
          // The backend now returns fresh school branding on every refresh.
          // This means if the owner updates name/logo/shortName, all other
          // logged-in users see the change on their next token refresh —
          // no re-login required.
          if (isSchool && res.school) {
            this.saveSchoolBrandingToStorage(res.school, decoded?.schoolCode ?? null);
          }

          this.refreshSubject.next(res.access_token);
          this.isRefreshing = false;
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.refreshSubject.error(err);
          this.logout();
          this.toast.error('Session expired. Please log in again.');
          return throwError(() => err);
        })
      );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const refreshToken = localStorage.getItem(KEYS.REFRESH_TOKEN);
    const isSchool = this.userType() === 'school';

    if (refreshToken) {
      const endpoint = isSchool ? 'school/auth/logout' : 'auth/logout';
      this.api.post(endpoint, { refresh_token: refreshToken }).subscribe({ error: () => {} });
    }

    this.clearAuth();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(KEYS.ACCESS_TOKEN);
  }

  getSchoolCode(): string | null {
    return this.schoolCode();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE AUTH  (public so signup can call saveSchoolAuth directly)
  // ═══════════════════════════════════════════════════════════════════════════

  saveSchoolAuth(res: any, schoolCode?: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const code = schoolCode || res.user?.schoolCode;
    const decoded = this.decodeJwt(res.access_token);
    const perms: string[] = decoded?.permissions ?? [];

    // Role comes from the JWT `role` claim (set by generateSchoolTokens).
    // Fall back to the login response top-level `role` field if needed.
    const role: string = decoded?.role ?? res.role ?? res.user?.role ?? '';

    localStorage.setItem(KEYS.ACCESS_TOKEN, res.access_token);
    localStorage.setItem(KEYS.REFRESH_TOKEN, res.refresh_token);
    localStorage.setItem(KEYS.USER_TYPE, 'school');
    localStorage.setItem(KEYS.SCHOOL_USER, JSON.stringify(res.user));
    localStorage.setItem(KEYS.PERMISSIONS, JSON.stringify(perms));
    localStorage.setItem(KEYS.USER_ROLE, role);
    if (code) localStorage.setItem(KEYS.SCHOOL_CODE, code);

    // ── NEW: persist school branding from login response ──────────────────
    // res.school is the SchoolBranding object from the backend login handler.
    // We pass `code` so the stored object always has the uniqueCode available
    // for the header fallback.
    if (res.school) {
      this.saveSchoolBrandingToStorage(res.school, code ?? null);

      // ── Apply CSS theme vars immediately so the dashboard renders branded ──
      // The login response includes theme if the backend joins it (see below).
      // If not present here, SchoolLayout.ngOnInit() fetches it as a fallback.
      if (res.school.theme) {
        this.themeService.applySchoolTheme(res.school.theme);
      }
    }

    this.isAuthenticated.set(true);
    this.userType.set('school');
    this.permissions.set(perms);
    this.schoolCode.set(code ?? null);
    this.schoolUser.set(res.user ?? null);
    this.userRole.set(role);
    // Clear super state
    this.superUser.set(null);
    this.superPermissions.set([]);
  }

  // ── NEW: centralised helper — writes the schoolInfo key ──────────────────
  // Called by saveSchoolAuth (login) and refresh tap.
  // Also called by school-info.service.ts and school-info.component.ts
  // to patch individual fields after a settings update.
  //
  // `schoolCode` param is the uniqueCode string (not the KEYS.SCHOOL_CODE key).
  // It is passed here so the stored object always has `code` populated even
  // when the backend response does not repeat it (uniqueCode travels in JWT).
  saveSchoolBrandingToStorage(branding: Partial<SchoolBranding>, schoolCode: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      // Merge with existing value so partial updates (from settings page) don't
      // wipe fields they didn't touch.
      const existing = this.getStoredSchoolBranding();
      const updated: SchoolBranding = {
        name: branding.name ?? existing?.name ?? '',
        shortName:
          branding.shortName !== undefined ? branding.shortName : existing?.shortName ?? null,
        code: schoolCode ?? existing?.code ?? '',
        addressLineOne: branding.addressLineOne ?? existing?.addressLineOne ?? '',
        addressLineTwo: branding.addressLineTwo ?? existing?.addressLineTwo ?? '',
        phone: branding.phone ?? existing?.phone ?? '',
        alternatePhone: branding.alternatePhone ?? existing?.alternatePhone ?? '',
        email: branding.email ?? existing?.email ?? '',
        logoUrl: branding.logoUrl !== undefined ? branding.logoUrl : existing?.logoUrl ?? null,
        tagline: branding.tagline !== undefined ? branding.tagline : existing?.tagline ?? null,
        theme: branding.theme !== undefined ? branding.theme : existing?.theme ?? null, 
      };
      localStorage.setItem(KEYS.SCHOOL_INFO, JSON.stringify(updated));
    } catch {
      // non-critical
    }
  }

  // ── Read helper — used by SchoolHeader and other consumers ───────────────
  getStoredSchoolBranding(): SchoolBranding | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(KEYS.SCHOOL_INFO);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ----------------------------------------

  private saveSuperAuth(res: any): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const decoded = this.decodeJwt(res.access_token);
    const perms: string[] = decoded?.permissions ?? [];

    localStorage.setItem(KEYS.ACCESS_TOKEN, res.access_token);
    localStorage.setItem(KEYS.REFRESH_TOKEN, res.refresh_token);
    localStorage.setItem(KEYS.USER_TYPE, 'super');
    localStorage.setItem(KEYS.SUPER_USER, JSON.stringify(res.user));
    localStorage.setItem(KEYS.SUPER_PERMS, JSON.stringify(perms));

    this.isAuthenticated.set(true);
    this.userType.set('super');
    this.superUser.set(res.user ?? null);
    this.superPermissions.set(perms);
    // Clear school state
    this.permissions.set([]);
    this.schoolCode.set(null);
    this.schoolUser.set(null);
  }

  private _initialised = false;

  /** Called by authReadyGuard before any route resolves. Idempotent. */
  ensureInitialised(): void {
    if (this._initialised) return;
    if (isPlatformBrowser(this.platformId)) {
      this.loadAuthState();
    }
    this._initialised = true;
  }

  private loadAuthState(): void {
    const token = localStorage.getItem(KEYS.ACCESS_TOKEN);
    const userType = localStorage.getItem(KEYS.USER_TYPE) as UserType | null;
    if (!token || !userType) return;

    this.isAuthenticated.set(true);
    this.userType.set(userType);

    if (userType === 'school') {
      const perms = JSON.parse(localStorage.getItem(KEYS.PERMISSIONS) || '[]');
      const user = JSON.parse(localStorage.getItem(KEYS.SCHOOL_USER) || 'null');
      const code = localStorage.getItem(KEYS.SCHOOL_CODE);

      // ──  use KEYS constant for consistency ──────────────────────────
      // Original used the magic string 'userRole'; now using KEYS.USER_ROLE.
      // Both resolve to the same localStorage key ('userRole') so existing
      // persisted values are read correctly without any migration needed.
      const role = localStorage.getItem(KEYS.USER_ROLE) ?? '';

      this.permissions.set(perms);
      this.schoolUser.set(user);
      this.schoolCode.set(code);
      this.userRole.set(role);
    } else {
      const perms = JSON.parse(localStorage.getItem(KEYS.SUPER_PERMS) || '[]');
      const user = JSON.parse(localStorage.getItem(KEYS.SUPER_USER) || 'null');
      this.superPermissions.set(perms);
      this.superUser.set(user);
    }
  }

  private clearAuth(): void {
    // ── Wipe parent children from ParentService + localStorage ──────────────
    // Must happen BEFORE we clear localStorage so ParentService can clean up
    // its own keys (activeChildId, parentChildren).
    this.parentService.clear();

    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('schoolTheme');
    localStorage.removeItem('schoolCode');
    localStorage.removeItem('userRole');
    // 'schoolInfo' is now KEYS.SCHOOL_INFO so it's covered above,
    // but keep this line as a safety net for any lingering old keys.
    localStorage.removeItem('schoolInfo');

    this.isAuthenticated.set(false);
    this.userType.set(null);
    this.permissions.set([]);
    this.schoolCode.set(null);
    this.schoolUser.set(null);
    this.superUser.set(null);
    this.superPermissions.set([]);
    this.userRole.set('');

    this.themeService.clearTheme();
    this.router.navigate(['/login']);
  }

  private decodeJwt(token: string): any {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }
}
