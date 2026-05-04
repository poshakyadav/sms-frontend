// notification.service.ts
import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { catchError, finalize, interval, Observable, tap, throwError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';

export interface SchoolNotification {
  id: number;
  title: string;
  message: string;
  createdAt: string;
  dueDate?: string;
  link?: string;
  isRead: boolean;
}

export type TargetType =
  | 'SCHOOL'
  | 'CLASS'
  | 'STUDENT'
  | 'ALL_STAFF'
  | 'INTERNAL_STAFF'
  | 'OPERATION_STAFF'
  | 'STUDENT_PARENT'
  | 'EXTERNAL_USER';

export interface CreateNotificationDto {
  title: string;
  message: string;
  targetType: TargetType;
  classSectionId?: number;
  studentId?: number;
  dueDate?: string;
  link?: string;
}

export interface NotificationReport {
  total: number;
  readCount: number;
  unread: number;
  percentageRead: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  private platformId = inject(PLATFORM_ID);

  // ====================== REACTIVE STATE (Signals) ======================
  private _notifications = signal<SchoolNotification[]>([]);
  private _unreadCount = signal<number>(0);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  // Public computed signals (use these in components)
  readonly notifications = computed(() => this._notifications());
  readonly unreadCount = computed(() => this._unreadCount());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  // ── PBAC: canSend is true if user has notifications.send permission ──────
  readonly canSend = computed(() => this.auth.hasPermission('notifications.send'));

  // NOTE: No constructor polling. fetchUnreadCount() is called once on app
  // load by BellNotifications.ngOnInit(). All subsequent refreshes are
  // either user-triggered (refresh button) or implicit (loadNotifications
  // keeps the list fresh). This keeps Cloudflare Workers request usage minimal.
  /** 
  constructor() {
    // Only start polling in the browser — the server has no auth state
    // and no localStorage, so polling from SSR produces only unauthenticated
    // preflight spam (which is exactly what you see in your backend logs)
    if (isPlatformBrowser(this.platformId)) {
      this.startUnreadPolling();
    }
  }
*/

  // ====================== PRIVATE POLLING ======================
  /** 
  private startUnreadPolling(): void {
    interval(30000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.auth.isAuthenticated()) {
          this.fetchUnreadCount();
        }
      });
  }
*/

  // ====================== FETCH ALL NOTIFICATIONS ======================
  loadNotifications(): void {
    // ── GUARD: never fire during SSR ──────────────────────────────────────
    if (!isPlatformBrowser(this.platformId)) return;
 
    this._loading.set(true);
    this._error.set(null);
 
    this.api
      .get<{ notifications: SchoolNotification[] }>('school/notifications')
      .pipe(
        tap((res) => {
          const notifs = res.notifications ?? [];
          this._notifications.set(notifs);
          // Keep unread count in sync with the loaded list — no extra request needed
          this._unreadCount.set(notifs.filter((n) => !n.isRead).length);
        }),
        catchError((err) => {
          this._error.set(err.message || 'Failed to load notifications');
          this.toast.error('Failed to load notifications');
          return throwError(() => err);
        }),
        // finalize inside tap — use a manual finally pattern to avoid importing finalize
      )
      .subscribe({
        error: () => this._loading.set(false),
        complete: () => this._loading.set(false),
      });
  }

  // ====================== CREATE NOTIFICATION (Admin only) ======================
  createNotification(data: CreateNotificationDto): Observable<any> {
    return this.api.post<{ notification: any; message: string }>('school/notifications', data).pipe(
      tap((res) => {
        this.toast.success(res.message || 'Notification created successfully');
        this.loadNotifications();
        this.refreshUnreadCount();
      }),
      catchError((err) => {
        this.toast.error(err.message || 'Failed to create notification');
        return throwError(() => err);
      })
    );
  }

  // ====================== MARK AS READ (Optimistic) ======================
  markAsRead(notificationId: number): void {
    // ── GUARD ─────────────────────────────────────────────────────────────
    if (!isPlatformBrowser(this.platformId)) return;

    // Optimistic update
    this._notifications.update((notifs) =>
      notifs.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );

    if (this._unreadCount() > 0) {
      this._unreadCount.update((count) => count - 1);
    }

    this.api
      .post('school/notifications/mark-read', { notificationId })
      .pipe(
        catchError((err) => {
          // Rollback on error
          this.loadNotifications();
          this.toast.error('Failed to mark notification as read');
          return throwError(() => err);
        })
      )
      .subscribe();
  }

  // ====================== MARK ALL AS READ ======================
  markAllAsRead(): void {
    const unread = this._notifications().filter((n) => !n.isRead);
    unread.forEach((n) => this.markAsRead(n.id));
  }

  // ====================== UNREAD COUNT ======================
   // Called once on app load by BellNotifications.ngOnInit()
  fetchUnreadCount(): void {
    // ── GUARD ─────────────────────────────────────────────────────────────
    if (!isPlatformBrowser(this.platformId)) return;

    this.api
      .get<{ count: number }>('school/notifications/unread-count')
      .pipe(
        tap((res) => this._unreadCount.set(res.count ?? 0)),
        catchError(() => throwError(() => null))
      )
      .subscribe();
  }

  refreshUnreadCount(): void {
    this.fetchUnreadCount();
  }

  // ====================== NOTIFICATION REPORT (Admin only) ======================
  getReport(notificationId: number): Observable<{ report: NotificationReport }> {
    return this.api
      .get<{ report: NotificationReport }>(`school/notifications/report/${notificationId}`)
      .pipe(
        catchError((err) => {
          this.toast.error('Failed to load notification report');
          return throwError(() => err);
        })
      );
  }

  // ====================== HELPER: Clear state (on logout) ======================
  clearState(): void {
    this._notifications.set([]);
    this._unreadCount.set(0);
    this._error.set(null);
  }
}
