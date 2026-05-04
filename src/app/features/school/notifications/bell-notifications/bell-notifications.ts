// bell-notifications.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import {
  NotificationService,
  SchoolNotification,
} from '../../../../core/services/notification.service';

@Component({
  selector: 'app-bell-notifications',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './bell-notifications.html',
  styleUrl: './bell-notifications.scss',
})
export class BellNotifications implements OnInit {
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  private platformId = inject(PLATFORM_ID);

  unreadCount = this.notificationService.unreadCount;
  notifications = this.notificationService.notifications;
  loading = this.notificationService.loading;

  // Show latest 6 in dropdown
  recentNotifications = computed(() => this.notifications().slice(0, 6));

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // ── Single request on app load ────────────────────────────────────────
    // school-header is always mounted when a school user is logged in, so
    // this fires exactly once per session — populating the bell badge
    // without any background polling.
    this.notificationService.refreshUnreadCount();
  }

  onMenuOpened(): void {
    // Load full list only on first open — subsequent opens reuse cached state.
    // If user needs fresh data they can visit /school/notifications and use
    // the refresh button there.
    if (this.notifications().length === 0) {
      this.notificationService.loadNotifications();
    }
  }

  markAsRead(notification: SchoolNotification, event?: Event): void {
    event?.stopPropagation();
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id);
    }
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllAsRead(event: Event): void {
    event.stopImmediatePropagation();
    this.notificationService.markAllAsRead();
  }

  viewAllNotifications(): void {
    this.router.navigate(['/school/notifications']);
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
}
