import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  OnInit,
  Output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

interface SuperNotification {
  id: number;
  icon: string;
  text: string;
  time: string;
  unread: boolean;
  severity: 'info' | 'warning' | 'critical';
}

@Component({
  selector: 'app-super-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatRippleModule,
  ],
  templateUrl: './super-header.html',
  styleUrl: './super-header.scss',
})
export class SuperHeader implements OnInit {
  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);
  private elRef = inject(ElementRef);

  @Output() hamburgerClick = new EventEmitter<void>();

  notificationCount = signal(2);
  notificationPanelOpen = signal(false);

  // Default to true (dark) — super portal is dark by default
  isDarkMode = signal(true);

  // roleLabel = computed(() => {
  //   const map: Record<string, string> = {
  //     SUPERADMIN: 'Super Admin',
  //     SUPERMANAGER: 'Super Manager',
  //     SUPERUSER: 'Super User',
  //   };
  //   const perms = this.auth.superPermissions();
  //   if (perms.includes('*')) return 'Super Admin';
  //   return 'Super User';
  // });

  roleLabel = computed(() => {
    const perms = this.auth.superPermissions();
    if (perms.includes('*')) return 'Super Admin';
    return 'Super User';
  });

  userName = computed(() => {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      const u = this.auth.superUser();
      return u?.name ?? 'Admin';
    } catch {
      return 'Admin';
    }
  });

  userInitials = computed(() => {
    const name = this.userName();
    if (!name) return 'SA';
    return (
      name
        .trim()
        .split(/\s+/)
        .map((w: string) => w[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2) || 'SA'
    );
  });

  notifications = signal<SuperNotification[]>([
    {
      id: 1,
      icon: 'business',
      text: 'New school "Sunrise Academy" registered',
      time: '5m ago',
      unread: true,
      severity: 'info',
    },
    {
      id: 2,
      icon: 'warning',
      text: 'Database shard db-03 approaching storage limit',
      time: '32m ago',
      unread: true,
      severity: 'warning',
    },
  ]);

  systemStatus = signal<'healthy' | 'degraded' | 'outage'>('healthy');

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Read saved preference. Default is 'dark' (stored as 'dark' or absent).
    const saved = localStorage.getItem('superDarkMode');
    const isDark = saved !== 'light'; // anything other than explicit 'light' = dark
    this.isDarkMode.set(isDark);

    // Apply the theme attribute to <html> directly — no router side-effect.
    // ThemeService.setDarkMode is intentionally NOT called here to avoid
    // any navigation side-effects. We just set the attribute directly.
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  toggleDarkMode(): void {
    const next = !this.isDarkMode();
    this.isDarkMode.set(next);

    // Now we call ThemeService — user clicked, no navigation will happen
    this.themeService.setDarkMode(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('superDarkMode', next ? 'dark' : 'light');
    }
  }

  toggleNotifications(): void {
    this.notificationPanelOpen.update((v) => !v);
  }

  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, unread: false })));
    this.notificationCount.set(0);
  }

  onHamburgerClick(): void {
    this.hamburgerClick.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notificationPanelOpen()) return;
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.notificationPanelOpen.set(false);
    }
  }
}
