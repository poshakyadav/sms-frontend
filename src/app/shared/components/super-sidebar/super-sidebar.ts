// super-sidebar.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

// ─── Nav definitions ──────────────────────────────────────────────────────────

export interface SuperNavItem {
  label: string;
  icon: string;
  route: string;
  /** PBAC: any one of these permission slugs grants access */
  permissions: string[];
  badge?: string;
  badgeType?: 'info' | 'warning' | 'critical';
}

export interface SuperNavGroup {
  groupLabel?: string;
  items: SuperNavItem[];
}

// All super permission slugs mapped to nav
export const SUPER_NAV_GROUPS: SuperNavGroup[] = [
  {
    items: [
      {
        label: 'Dashboard',
        icon: 'monitor_heart',
        route: '/super/dashboard',
        permissions: ['dashboard.view'],
      },
    ],
  },
  {
    groupLabel: 'Management',
    items: [
      {
        label: 'Schools',
        icon: 'domain',
        route: '/super/schools',
        permissions: ['schools.list', 'schools.manage'],
      },
      {
        label: 'Users',
        icon: 'manage_accounts',
        route: '/super/users',
        permissions: ['users.list'],
      },
      {
        label: 'Roles',
        icon: 'security',
        route: '/super/roles',
        permissions: ['roles.manage'],
      },
      {
        label: 'Access Plans',
        icon: 'sell',
        route: '/super/access-plans',
        permissions: ['access-plans.view', 'access-plans.manage'],
      },
      {
        label: 'Message Bundles',
        icon: 'forum',
        route: '/super/message-bundles',
        permissions: ['message-bundles.view', 'message-bundles.manage'],
      },
      {
        label: 'Permission Sync',
        icon: 'sync_lock',
        route: '/super/permission-sync',
        permissions: ['schools.manage'],
      },
      {
        label: 'School Requests',
        icon: 'domain_add',
        route: '/super/school-requests',
        permissions: ['school-requests.view'],
      },
      {
        label: 'Contact Messages',
        icon: 'mark_email_unread',
        route: '/super/contact-messages',
        permissions: ['contact-messages.view'],
      },
    ],
  },
  {
    groupLabel: 'Infrastructure',
    items: [
      {
        label: 'Turso Databases',
        icon: 'storage',
        route: '/super/turso-dbs',
        permissions: ['turso.manage'],
        badge: 'DB',
        badgeType: 'info',
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-super-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatRippleModule, MatTooltipModule],
  templateUrl: './super-sidebar.html',
  styleUrl: './super-sidebar.scss',
})
export class SuperSidebar implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  isCollapsed = signal(false);
  mobileOpen = signal(false);
  currentRoute = signal('');

  /** Controls the logout confirmation modal */
  logoutModalOpen = signal(false);

  private routerSub!: Subscription;

  // ── PBAC-filtered navigation ─────────────────────────────────────────────
  filteredGroups = computed<SuperNavGroup[]>(() => {
    return SUPER_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.permissions.some((p) => this.auth.hasSuperPermission(p))
      ),
    })).filter((group) => group.items.length > 0);
  });

  // ── User info ─────────────────────────────────────────────────────────────
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

  roleLabel = computed(() => {
    const perms = this.auth.superPermissions();
    if (perms.includes('*')) return 'Super Admin';
    return 'Super User';
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.currentRoute.set(this.router.url);

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentRoute.set(e.urlAfterRedirects);
        this.mobileOpen.set(false);
      });

    const saved = localStorage.getItem('superSidebarCollapsed');
    if (saved === 'true') this.isCollapsed.set(true);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  isItemActive(item: SuperNavItem): boolean {
    return this.currentRoute().startsWith(item.route);
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('superSidebarCollapsed', String(this.isCollapsed()));
    }
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  // ── Logout modal ──────────────────────────────────────────────────────────
  openLogoutModal(): void {
    this.logoutModalOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutModalOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.auth.logout();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.logoutModalOpen()) {
      this.logoutModalOpen.set(false);
      return;
    }
    this.mobileOpen.set(false);
  }

  /** @deprecated Use openLogoutModal() instead */
  logout(): void {
    this.openLogoutModal();
  }
}
