// school-header.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  HostListener,
  inject,
  OnInit,
  Output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { BellNotifications } from '../../../features/school/notifications/bell-notifications/bell-notifications';
import { ParentChildSwitcherComponent } from '../../../features/school/parents/parent-child-switcher/parent-child-switcher';

interface SchoolInfo {
  name: string;
  shortName: string | null;
  code: string;
  logoUrl: string | null;
  tagline: string | null;
}

@Component({
  selector: 'app-school-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatRippleModule,
    BellNotifications,
    ParentChildSwitcherComponent,
  ],
  templateUrl: './school-header.html',
  styleUrl: './school-header.scss',
})
export class SchoolHeader implements OnInit {
  private themeService = inject(ThemeService);
  private auth = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  @Output() hamburgerClick = new EventEmitter<void>();

  schoolInfo = signal<SchoolInfo | null>(null);
  userMenuOpen = signal(false);

  /** Controls the logout confirmation modal */
  logoutModalOpen = signal(false);

  isDarkMode = this.themeService.isDarkMode;

  schoolAbbr = computed(() => {
    const name = this.schoolInfo()?.name ?? '';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'S';
    if (words.length === 1) return name.slice(0, 2).toUpperCase();
    return words.map((w) => w[0].toUpperCase()).join('');
  });

  displayName = computed(() => {
    const info = this.schoolInfo();
    if (!info) return '';
    const shortName = info.shortName?.trim();
    if (shortName) return shortName.toUpperCase();
    const abbr = this.schoolAbbr();
    if (abbr && abbr !== 'S') return abbr;
    return info.code ?? '';
  });

  logoInitials = computed(() => {
    return this.displayName().slice(0, 2);
  });

  headerTooltip = computed(() => {
    return this.schoolInfo()?.name ?? '';
  });

  userName = computed(() => {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      const u = this.auth.schoolUser();
      return u?.name ?? u?.email ?? '';
    } catch {
      return '';
    }
  });

  userInitials = computed(() => {
    const name = this.userName();
    if (!name) return '?';
    return name
      .trim()
      .split(/\s+/)
      .map((w: string) => w[0].toUpperCase())
      .join('')
      .slice(0, 2);
  });

  roleLabel = computed(() => {
    const map: Record<string, string> = {
      SCHOOL_OWNER: 'School Owner',
      PRINCIPAL: 'Principal',
      MANAGER: 'Manager',
      TEACHER: 'Teacher',
      STUDENT: 'Student',
      STUDENT_PARENT: 'Parent',
      ACCOUNTANT: 'Accountant',
      ADMISSION_OFFICER: 'Admission Officer',
    };
    const role = this.auth.userRole() ?? '';
    return map[role] ?? role;
  });

  isParent = computed(() => this.auth.userRole() === 'STUDENT_PARENT');

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadSchoolInfo();
  }

  private loadSchoolInfo(): void {
    const raw = localStorage.getItem('schoolInfo');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.schoolInfo.set({
          name: parsed.name ?? '',
          shortName: parsed.shortName ?? null,
          code: parsed.code ?? '',
          logoUrl: parsed.logoUrl ?? null,
          tagline: parsed.tagline ?? null,
        });
        return;
      } catch {
        // Fall through to legacy path
      }
    }
    const code = localStorage.getItem('schoolCode');
    if (code) {
      this.schoolInfo.set({
        name: code,
        shortName: null,
        code,
        logoUrl: null,
        tagline: null,
      });
    }
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  onLogoError(): void {
    this.schoolInfo.update((s) => (s ? { ...s, logoUrl: null } : s));
  }

  onHamburgerClick(): void {
    this.hamburgerClick.emit();
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  // ── Logout modal ──────────────────────────────────────────────────────────
  openLogoutModal(): void {
    this.userMenuOpen.set(false); // close dropdown first
    this.logoutModalOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutModalOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.auth.logout();
  }

  /** @deprecated Use openLogoutModal() instead */
  logout(): void {
    this.openLogoutModal();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.logoutModalOpen()) {
      this.logoutModalOpen.set(false);
      return;
    }
    this.userMenuOpen.set(false);
  }
}
