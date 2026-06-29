// src/app/shared/components/access-expiry-banner/access-expiry-banner.ts
//
// Drop this into SchoolLayout's template, near the top (above <router-outlet/>).
// It's self-sufficient: if BillingService hasn't loaded the full access status
// yet, it triggers a lightweight fetch itself, so it works regardless of
// which page the user lands on first.

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../../../../core/services/billing.service';

const DISMISS_KEY = 'billingBannerDismissedForDays';

@Component({
  selector: 'app-access-expiry-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
    <div class="access-banner" [class.access-banner--expired]="isExpired()">
      <div class="access-banner__content">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        @if (isExpired()) {
        <span>Your portal access has expired. Renew now to avoid interruption.</span>
        } @else {
        <span
          >Your access expires in <strong>{{ daysRemaining() }}</strong>
          {{ daysRemaining() === 1 ? 'day' : 'days' }}.</span
        >
        }
      </div>
      <div class="access-banner__actions">
        <a routerLink="/school/billing/plans" class="access-banner__cta">Renew now</a>
        @if (!isExpired()) {
        <button class="access-banner__dismiss" (click)="dismiss()" aria-label="Dismiss">✕</button>
        }
      </div>
    </div>
    }
  `,
  styles: [
    `
      .access-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px 18px;
        background: #fffbeb;
        border-bottom: 1px solid #fde68a;
        color: #92400e;
        font-size: 0.85rem;
      }
      .access-banner--expired {
        background: #fef2f2;
        border-bottom-color: #fecaca;
        color: #991b1b;
      }

      .access-banner__content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .access-banner__actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .access-banner__cta {
        padding: 5px 14px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8rem;
        background: #4f46e5;
        color: #fff;
        text-decoration: none;
        white-space: nowrap;
      }
      .access-banner__cta:hover {
        background: #4338ca;
      }

      .access-banner__dismiss {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: inherit;
        opacity: 0.6;
        padding: 0 4px;
      }
      .access-banner__dismiss:hover {
        opacity: 1;
      }
    `,
  ],
})
export class AccessExpiryBanner implements OnInit {
  private billing = inject(BillingService);
  private platformId = inject(PLATFORM_ID);

  private dismissed = signal(false);

  daysRemaining = computed(() => this.billing.effectiveDaysRemaining());

  isExpired = computed(() => {
    const status = this.billing.accessStatus();
    return status !== null && !status.hasAccess;
  });

  visible = computed(() => {
    if (this.isExpired()) return true; // never dismissible
    if (this.dismissed()) return false;
    return this.billing.showExpiryBanner();
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.dismissed.set(this.readDismissed());
    }
    if (!this.billing.accessStatus()) {
      this.billing.loadAccessStatus().subscribe();
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.setItem(DISMISS_KEY, String(this.billing.effectiveDaysRemaining()));
    } catch {
      // non-critical
    }
  }

  // Re-shows the banner if the day count has moved since it was dismissed
  // (e.g. dismissed at "5 days left", comes back the next day at "4 days left").
  private readDismissed(): boolean {
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY);
      if (stored === null) return false;
      return parseInt(stored, 10) === this.billing.effectiveDaysRemaining();
    } catch {
      return false;
    }
  }
}
