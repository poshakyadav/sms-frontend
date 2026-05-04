// notifications-list.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import {
  NotificationService,
  SchoolNotification,
} from '../../../../core/services/notification.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './notifications-list.html',
  styleUrl: './notifications-list.scss',
})
export class NotificationsList implements OnInit {
  notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // ── Filter state ─────────────────────────────────────────────────────────
  filter = signal<'all' | 'unread' | 'read'>('all');
  searchTerm = signal<string>('');

  // ── Service signals ───────────────────────────────────────────────────────
  notifications = this.notificationService.notifications;
  loading = this.notificationService.loading;
  error = this.notificationService.error;

  // ── PBAC: use permission check, not role check ────────────────────────────
  canSend = computed(() => this.authService.hasPermission('notifications.send'));

  // ── Filtered list (reactive computed) ─────────────────────────────────────
  filteredNotifications = computed(() => {
    let list = this.notifications();

    if (this.filter() === 'unread') list = list.filter((n) => !n.isRead);
    else if (this.filter() === 'read') list = list.filter((n) => n.isRead);

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      list = list.filter(
        (n) => n.title.toLowerCase().includes(term) || n.message.toLowerCase().includes(term)
      );
    }

    return list;
  });

  unreadFiltered = computed(() => this.filteredNotifications().filter((n) => !n.isRead).length);

  skeletons = Array(5).fill(0);

  ngOnInit(): void {
    // loadNotifications() also syncs _unreadCount from the response,
    // so no separate refreshUnreadCount() call is needed here.
    this.notificationService.loadNotifications();
    // this.notificationService.refreshUnreadCount();
  }

  setFilter(value: 'all' | 'unread' | 'read'): void {
    this.filter.set(value);
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  markAsRead(notification: SchoolNotification, event?: Event): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id);
    }
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
    this.toast.success('All notifications marked as read');
  }

  viewReport(notificationId: number, event: Event): void {
    event.stopImmediatePropagation();
    this.router.navigate(['/school/notifications/report', notificationId]);
  }

  createNewNotification(): void {
    this.router.navigate(['/school/notifications/new']);
  }

  getTimeAgo(createdAt: string): string {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  retry(): void {
    this.notificationService.loadNotifications();
  }
}
