// school-settings-hub.ts
// Central settings & information hub for all school portal users.
// Shows permission-gated setting cards + public informational pages.

import { Component, computed, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../../core/services/auth.service';

import { APP_CONSTANTS } from '../../../../app-constants';

// ─── Section / Card definitions ───────────────────────────────────────────────

interface SettingsCard {
  key: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  permission: string | null; // null = public / always visible
  accentClass: string; // CSS class for the icon accent color
  external?: boolean; // opens in new tab
}

interface SettingsSection {
  title: string;
  subtitle: string;
  icon: string;
  cards: SettingsCard[];
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  // ── School Settings (permission-gated) ──────────────────────────────────
  {
    title: 'School Settings',
    subtitle: 'Manage your school portal configuration',
    icon: 'tune',
    cards: [
      {
        key: 'theme',
        label: 'Theme & Appearance',
        description: 'Customise colours, fonts and branding for the school portal.',
        icon: 'palette',
        route: '/school/settings/theme',
        permission: 'settings.manage',
        accentClass: 'accent-primary',
      },
      {
        key: 'school-info',
        label: 'School Information',
        description: 'Update school name, logo, tagline and contact details.',
        icon: 'business',
        route: '/school/settings/info',
        permission: 'settings.manage',
        accentClass: 'accent-info',
      },
      {
        key: 'about-us-editor',
        label: 'About Us Editor',
        description: 'Edit the About Us page visible to all school portal users.',
        icon: 'edit_note',
        route: '/school/settings/about-us',
        permission: 'settings.manage',
        accentClass: 'accent-secondary',
      },
    ],
  },

  // ── My Account ──────────────────────────────────────────────────────────
  {
    title: 'My Account',
    subtitle: 'View and manage your personal profile',
    icon: 'account_circle',
    cards: [
      {
        key: 'my-profile',
        label: 'My Profile',
        description: 'View and update your personal information and credentials.',
        icon: 'person',
        route: '/school/profile/me',
        permission: null, // every authenticated user
        accentClass: 'accent-success',
      },
    ],
  },

  // ── School Information Pages ─────────────────────────────────────────────
  {
    title: 'School Information',
    subtitle: 'Information about your school portal',
    icon: 'info',
    cards: [
      {
        key: 'school-about',
        label: 'About Our School',
        description: 'Learn more about this school and its mission.',
        icon: 'school',
        route: '/school/about-us',
        permission: null,
        accentClass: 'accent-primary',
      },
      {
        key: 'school-contact',
        label: 'School Contact',
        description: "View the school's phone numbers, email address and physical location.",
        icon: 'contacts',
        route: '/school/school-contact',
        permission: null, // visible to every authenticated user
        accentClass: 'accent-warning',
      },
    ],
  },

  // ── Application Information (Public) ────────────────────────────────────
  {
    title: 'Application Information',
    subtitle: 'Legal, security and platform information',
    icon: 'gavel',
    cards: [
      {
        key: 'app-about',
        label: `About ${APP_CONSTANTS.appName}`,
        description: `Learn about the ${APP_CONSTANTS.appName} school management platform.`,
        icon: 'info',
        route: '/public/about',
        permission: null,
        accentClass: 'accent-secondary',
      },
      {
        key: 'app-terms',
        label: 'Terms & Conditions',
        description: 'Read the terms and conditions governing use of this platform.',
        icon: 'article',
        route: '/public/terms',
        permission: null,
        accentClass: 'accent-warning',
      },
      {
        key: 'app-privacy',
        label: 'Privacy Policy',
        description: 'Understand how your data is collected, used and protected.',
        icon: 'privacy_tip',
        route: '/public/privacy',
        permission: null,
        accentClass: 'accent-info',
      },
      {
        key: 'app-security',
        label: 'Security Policy',
        description: 'Our commitment to keeping your school data safe and secure.',
        icon: 'security',
        route: '/public/security',
        permission: null,
        accentClass: 'accent-success',
      },
    ],
  },

  // ── Support ──────────────────────────────────────────────────────────────
  {
    title: 'Support',
    subtitle: 'Get help from our team',
    icon: 'support_agent',
    cards: [
      {
        key: 'contact',
        label: 'Contact Support',
        description: `Reach out to the ${APP_CONSTANTS.appName} team for technical assistance.`,
        icon: 'support_agent',
        route: '/school/contact-us',
        permission: 'contact.submit',
        accentClass: 'accent-error',
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-school-settings-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatRippleModule, MatTooltipModule],
  templateUrl: './school-settings-hub.html',
  styleUrl: './school-settings-hub.scss',
})
export class SchoolSettingsHub {
  private auth = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  readonly appConstants = APP_CONSTANTS;

  /** Role label for the banner greeting */
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

  /**
   * Filter sections: remove cards the user has no permission to see,
   * then remove sections that end up empty.
   */
  visibleSections = computed((): SettingsSection[] => {
    return SETTINGS_SECTIONS.map((section) => ({
      ...section,
      cards: section.cards.filter((card) =>
        card.permission === null ? true : this.auth.hasPermission(card.permission)
      ),
    })).filter((section) => section.cards.length > 0);
  });

  /** Total card count across all visible sections */
  totalCards = computed(() => this.visibleSections().reduce((sum, s) => sum + s.cards.length, 0));

  trackSection(_i: number, section: SettingsSection): string {
    return section.title;
  }

  trackCard(_i: number, card: SettingsCard): string {
    return card.key;
  }
}
