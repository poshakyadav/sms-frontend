// school-contact-info.ts
// Public school contact page — reads branding from localStorage (schoolInfo),
// shows phone, alternate phone, email, address details.
// Accessible by every authenticated school user (no permissionGuard).

import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService, SchoolBranding } from '../../../core/services/auth.service';

// ─── Contact item ─────────────────────────────────────────────────────────────

interface ContactItem {
  key: string;
  label: string;
  value: string;
  icon: string;
  accentClass: string;
  /** If truthy, wraps the value in an <a> with this href prefix */
  hrefPrefix?: string;
  /** aria-label for the action button */
  actionLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-school-contact-info',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatRippleModule, MatTooltipModule],
  templateUrl: './school-contact-info.html',
  styleUrl: './school-contact-info.scss',
})
export class SchoolContactInfo implements OnInit {
  private auth = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  branding = signal<SchoolBranding | null>(null);
  copied = signal<string | null>(null); // key of last copied item

  // ── School identity ──────────────────────────────────────────────────────

  schoolName = computed(() => this.branding()?.name || 'School');
  shortName = computed(() => this.branding()?.shortName || null);
  tagline = computed(() => this.branding()?.tagline || null);
  logoUrl = computed(() => this.branding()?.logoUrl || null);

  /** First 2 chars of shortName or full name for the avatar */
  logoInitials = computed(() => {
    const s = this.shortName();
    if (s) return s.slice(0, 2).toUpperCase();
    const words = this.schoolName().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'S';
    if (words.length === 1) return this.schoolName().slice(0, 2).toUpperCase();
    return words
      .map((w) => w[0].toUpperCase())
      .join('')
      .slice(0, 2);
  });

  /** Role-aware greeting */
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
    return map[this.auth.userRole() ?? ''] ?? this.auth.userRole() ?? '';
  });

  // ── Build contact items list from branding signal ────────────────────────

  contactItems = computed((): ContactItem[] => {
    const b = this.branding();
    if (!b) return [];

    const items: ContactItem[] = [];

    if (b.phone) {
      items.push({
        key: 'phone',
        label: 'Primary Phone',
        value: b.phone,
        icon: 'phone',
        accentClass: 'accent-primary',
        hrefPrefix: 'tel:',
        actionLabel: 'Call primary phone',
      });
    }

    if (b.alternatePhone) {
      items.push({
        key: 'alternatePhone',
        label: 'Alternate Phone',
        value: b.alternatePhone,
        icon: 'phone_in_talk',
        accentClass: 'accent-secondary',
        hrefPrefix: 'tel:',
        actionLabel: 'Call alternate phone',
      });
    }

    if (b.email) {
      items.push({
        key: 'email',
        label: 'Email',
        value: b.email,
        icon: 'alternate_email',
        accentClass: 'accent-info',
        hrefPrefix: 'mailto:',
        actionLabel: 'Send email',
      });
    }

    if (b.addressLineOne) {
      const addr = [b.addressLineOne, b.addressLineTwo].filter(Boolean).join(', ');
      items.push({
        key: 'address',
        label: 'Address',
        value: addr,
        icon: 'location_on',
        accentClass: 'accent-success',
        actionLabel: 'Copy address',
      });
    }

    return items;
  });

  /** True when at least one contact detail exists */
  hasDetails = computed(() => this.contactItems().length > 0);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const b = this.auth.getStoredSchoolBranding();
    this.branding.set(b);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onLogoError(): void {
    this.branding.update((b) => (b ? { ...b, logoUrl: null } : b));
  }

  async copyToClipboard(item: ContactItem): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      await navigator.clipboard.writeText(item.value);
      this.copied.set(item.key);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      // clipboard API unavailable — silent fail
    }
  }
}
