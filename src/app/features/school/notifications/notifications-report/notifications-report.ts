// notifications-report.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NotificationReport,
  NotificationService,
} from '../../../../core/services/notification.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-notifications-report',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './notifications-report.html',
  styleUrl: './notifications-report.scss',
})
export class NotificationsReport implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private toast = inject(ToastService);

  notificationId!: number;
  report = signal<NotificationReport | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  percentage = computed(() => this.report()?.percentageRead ?? 0);
  total = computed(() => this.report()?.total ?? 0);
  readCount = computed(() => this.report()?.readCount ?? 0);
  unreadCount = computed(() => this.report()?.unread ?? 0);

  // Circumference for SVG ring (r=70)
  readonly circumference = 2 * Math.PI * 70;
  strokeDashoffset = computed(
    () => this.circumference - (this.percentage() / 100) * this.circumference
  );

  ngOnInit(): void {
    this.notificationId = Number(this.route.snapshot.paramMap.get('id'));

    if (isNaN(this.notificationId)) {
      this.error.set('Invalid notification ID');
      this.loading.set(false);
      return;
    }

    this.loadReport();
  }

  private loadReport(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notificationService.getReport(this.notificationId).subscribe({
      next: (res) => {
        this.report.set(res.report);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load report');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/school/notifications']);
  }

  retry(): void {
    this.loadReport();
  }
}
