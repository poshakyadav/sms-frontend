// src/app/features/school/billing/components/billing-overview/billing-overview.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { BillingService } from '../../../../../core/services/billing.service';
import { AccessPaymentService } from '../../../../../core/services/access-payment.service';
import { WhatsappService } from '../../../whatsapp/services/whatsapp.service';
import { CreditBalanceChip } from '../../../whatsapp/components/shared/credit-balance-chip/credit-balance-chip';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-billing-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, CreditBalanceChip, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="billing-page">

      <!-- ── Page Header ─────────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Billing</h1>
          <p class="page-subtitle">Manage your portal access and messaging credits</p>
        </div>
        <a routerLink="history" class="btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3"/><path d="M3 4v4h4"/></svg>
          Payment History
        </a>
      </div>

      <!-- ── Loading Skeleton ───────────────────────────────────────────── -->
      @if (isLoading()) {
        <div class="skeleton-grid">
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
        </div>
      }

      <!-- ── Main Content ───────────────────────────────────────────────── -->
      @if (!isLoading()) {

        <!-- ACCESS STATUS CARD -->
        <div class="status-card" [class.status-card--expired]="billingService.isExpired()" [class.status-card--warning]="billingService.isExpiringSoon() && !billingService.isExpired()">

          <div class="status-card__header">
            <div class="status-icon" [class.status-icon--active]="billingService.hasAccess()" [class.status-icon--expired]="billingService.isExpired()">
              @if (billingService.hasAccess()) {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              } @else {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              }
            </div>
            <div class="status-card__meta">
              <h2 class="status-title">Portal Access</h2>
              <span class="status-badge" [class.status-badge--active]="billingService.hasAccess()" [class.status-badge--warning]="billingService.isExpiringSoon()" [class.status-badge--expired]="billingService.isExpired()">
                @if (billingService.hasAccess() && !billingService.isExpiringSoon()) { Active }
                @else if (billingService.isExpiringSoon()) { Expiring Soon }
                @else { Expired }
              </span>
            </div>
          </div>

          <div class="status-card__body">
            @if (billingService.hasAccess()) {
              <div class="expiry-info">
                @if (billingService.isExpiringSoon()) {
                  <p class="expiry-warning">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Your access expires in <strong>{{ billingService.daysRemaining() }} {{ billingService.daysRemaining() === 1 ? 'day' : 'days' }}</strong>. Renew now to avoid interruption.
                  </p>
                } @else {
                  <p class="expiry-ok">
                    Access valid for <strong>{{ billingService.daysRemaining() }} {{ billingService.daysRemaining() === 1 ? 'day' : 'days' }}</strong> — expires {{ formatDate(accessStatus()?.expiresAt) }}
                  </p>
                }

                <!-- Autopay status -->
                @if (billingService.autopayActive()) {
                  <div class="autopay-chip autopay-chip--on">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    Auto-renewal ON
                  </div>
                } @else {
                  <div class="autopay-chip autopay-chip--off">Auto-renewal OFF</div>
                }
              </div>

              <div class="status-card__actions">
                <a routerLink="plans" class="btn-primary">Renew / Extend Access</a>
                @if (billingService.autopayActive() && canManageBilling()) {
                  <button class="btn-danger-ghost" (click)="cancelAutopay()" [disabled]="cancellingAutopay()">
                    {{ cancellingAutopay() ? 'Cancelling…' : 'Cancel Auto-Renewal' }}
                  </button>
                }
              </div>
            } @else {
              <p class="expired-message">Your portal access has expired. Renew now to continue using the school management system.</p>
              <a routerLink="plans" class="btn-primary btn-primary--large">Renew Access →</a>
            }
          </div>
        </div>

        <!-- WHATSAPP BALANCE CARD + QUICK STATS CARD -->
        <div class="cards-row">

          <div class="info-card">
            <div class="info-card__header">
              <div class="info-card__icon info-card__icon--green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.529 5.845L.057 23.428c-.093.337.009.697.263.93a.93.93 0 0 0 .938.149l5.745-1.508A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.069a10.01 10.01 0 0 1-5.229-1.474l-.375-.222-3.861 1.013 1.033-3.752-.244-.392A10.015 10.015 0 0 1 1.931 12C1.931 6.427 6.427 1.931 12 1.931S22.069 6.427 22.069 12 17.573 22.069 12 22.069z"/></svg>
              </div>
              <h3 class="info-card__title">WhatsApp Credits</h3>
              <app-credit-balance-chip
                class="info-card__chip"
                [creditsRemaining]="wa.creditsRemaining()"
                [compact]="true"
                [showBuyLink]="false"
              />
            </div>
            <div class="info-card__value">
              {{ (wa.creditsRemaining() | number) ?? '—' }}
              <span class="info-card__unit">credits remaining</span>
            </div>
            @if (wa.balance(); as balance) {
              <p class="info-card__sub">{{ balance.creditsUsed | number }} used of {{ balance.totalCreditsEverPurchased | number }} purchased</p>
            }
            <div class="info-card__links">
              <a routerLink="bundles" class="info-card__cta">Buy more credits <mat-icon >arrow_forward</mat-icon></a>
              <a routerLink="/school/whatsapp" class="info-card__cta info-card__cta--secondary">Manage WhatsApp <mat-icon >arrow_forward</mat-icon></a>
            </div>
          </div>

          <!-- QUICK STATS CARD -->
          <div class="info-card">
            <div class="info-card__header">
              <div class="info-card__icon info-card__icon--indigo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <h3 class="info-card__title">Plan Overview</h3>
            </div>
            @if (accessStatus()?.autopay; as ap) {
              <div class="plan-detail">
                <span class="plan-label">{{ ap.planType }} Plan</span>
                @if (ap.nextChargeAt) {
                  <span class="plan-sub">Next renewal: {{ formatUnixDate(ap.nextChargeAt) }}</span>
                }
                <span class="plan-sub">{{ ap.paidCount }} {{ ap.paidCount === 1 ? 'cycle' : 'cycles' }} completed</span>
              </div>
            } @else {
              <div class="plan-detail">
                <span class="plan-label">Manual Renewal</span>
                <span class="plan-sub">No auto-renewal active</span>
              </div>
            }
            <a routerLink="plans" class="info-card__cta">Manage Plan <mat-icon >arrow_forward</mat-icon> </a>
          </div>
        </div>

        <!-- RECENT PAYMENTS SECTION (last 5) -->
        @if (recentPayments().length > 0) {
          <div class="recent-section">
            <div class="recent-header">
              <h3 class="recent-title">Recent Payments</h3>
              <a routerLink="history" class="view-all-link">View all →</a>
            </div>
            <div class="payments-list">
              @for (payment of recentPayments(); track payment.id) {
                <div class="payment-row">
                  <div class="payment-row__icon" [class]="'payment-row__icon--' + getPaymentTypeColor(payment.paymentType)">
                    {{ getPaymentTypeEmoji(payment.paymentType) }}
                  </div>
                  <div class="payment-row__info">
                    <span class="payment-row__desc">{{ payment.description }}</span>
                    <span class="payment-row__date">{{ formatDate(payment.capturedAt || payment.createdAt) }}</span>
                  </div>
                  <div class="payment-row__right">
                    <span class="payment-row__amount">₹{{ (payment.amountPaise / 100) | number:'1.0-0' }}</span>
                    <span class="payment-status" [class]="'payment-status--' + payment.status.toLowerCase()">{{ payment.status }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }

      } <!-- end !isLoading -->

    </div>
  `,
  styles: [`
    .billing-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 20px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .page-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary, #111827); margin: 0 0 4px; }
    .page-subtitle { font-size: 0.875rem; color: var(--color-text-secondary, #6b7280); margin: 0; }

    .btn-ghost {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px; font-size: 0.875rem; font-weight: 500;
      color: var(--color-text-secondary, #374151); background: transparent;
      border: 1px solid var(--color-border, #e5e7eb);
      text-decoration: none; white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-ghost:hover { background: var(--color-bg-subtle, #f9fafb); }

    /* Skeleton */
    .skeleton-grid { display: grid; gap: 16px; }
    .skeleton-card {
      height: 180px; border-radius: 12px;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Status card */
    .status-card {
      background: var(--color-bg-card, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 12px; padding: 24px;
      transition: border-color 0.2s;
    }
    .status-card--expired { border-color: #fca5a5; background: #fff5f5; }
    .status-card--warning { border-color: #fcd34d; background: #fffdf0; }

    .status-card__header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .status-icon {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #e5e7eb; color: #6b7280;
    }
    .status-icon--active { background: #d1fae5; color: #059669; }
    .status-icon--expired { background: #fee2e2; color: #dc2626; }
    .status-card__meta { flex: 1; }
    .status-title { font-size: 1.125rem; font-weight: 600; color: var(--color-text-primary, #111827); margin: 0 0 4px; }
    .status-badge {
      display: inline-block; padding: 2px 10px; border-radius: 99px;
      font-size: 0.75rem; font-weight: 600;
      background: #e5e7eb; color: #6b7280;
    }
    .status-badge--active { background: #d1fae5; color: #065f46; }
    .status-badge--warning { background: #fef3c7; color: #92400e; }
    .status-badge--expired { background: #fee2e2; color: #991b1b; }

    .status-card__body { padding-left: 56px; }
    .expiry-warning {
      display: flex; align-items: center; gap: 8px;
      color: #92400e; font-size: 0.9rem; margin: 0 0 12px;
    }
    .expiry-ok { color: var(--color-text-secondary, #374151); font-size: 0.9rem; margin: 0 0 12px; }
    .expired-message { color: #991b1b; font-size: 0.9rem; margin: 0 0 16px; }

    .autopay-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 600;
      margin-bottom: 16px;
    }
    .autopay-chip--on { background: #ecfdf5; color: #065f46; }
    .autopay-chip--off { background: #f3f4f6; color: #6b7280; }

    .status-card__actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .btn-primary {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 10px 20px; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      background: #4f46e5; color: #fff; border: none; text-decoration: none;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-primary:hover { background: #4338ca; }
    .btn-primary--large { padding: 12px 28px; font-size: 1rem; }
    .btn-danger-ghost {
      padding: 10px 16px; border-radius: 8px; font-size: 0.875rem; font-weight: 500;
      background: transparent; color: #dc2626; border: 1px solid #fca5a5;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-danger-ghost:hover:not(:disabled) { background: #fff5f5; }
    .btn-danger-ghost:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Cards row */
    .cards-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 600px) { .cards-row { grid-template-columns: 1fr; } }

    .info-card {
      background: var(--color-bg-card, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 12px; padding: 20px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .info-card__header { display: flex; align-items: center; gap: 10px; }
    .info-card__chip { margin-left: auto; }
    .info-card__icon {
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .info-card__icon--green { background: #d1fae5; color: #065f46; }
    .info-card__icon--indigo { background: #e0e7ff; color: #3730a3; }
    .info-card__title { font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary, #111827); margin: 0; }
    .info-card__value {
      font-size: 1.75rem; font-weight: 700;
      color: var(--color-text-primary, #111827); line-height: 1;
    }
    .info-card__unit { font-size: 0.8rem; font-weight: 400; color: var(--color-text-secondary, #6b7280); margin-left: 4px; }
    .info-card__sub { font-size: 0.8rem; color: var(--color-text-secondary, #6b7280); margin: 0; }
    .info-card__links { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
    .info-card__cta { 
      font-size: 0.85rem; 
      font-weight: 600; 
      color: #4f46e5; 
      text-decoration: none; 

       /* Add these lines */
       display: inline-flex;
        align-items: center;
        gap: 4px; /* Adjust this value to add space between text and arrow */

         /* Add this nested block to resize the icon */
        mat-icon {
          font-size: 1.1rem; /* Scales the icon graphic down */
          width: 1.1rem;     /* Matches the bounding box width */
          height: 1.1rem;    /* Matches the bounding box height */
        }
    }
    .info-card__cta:hover { text-decoration: underline; }
    .info-card__cta--secondary { color: var(--color-text-secondary, #6b7280); }

    .plan-label { font-size: 1rem; font-weight: 600; color: var(--color-text-primary, #111827); }
    .plan-sub { font-size: 0.8rem; color: var(--color-text-secondary, #6b7280); }
    .plan-detail { display: flex; flex-direction: column; gap: 4px; }

    /* Recent Payments */
    .recent-section {
      background: var(--color-bg-card, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 12px; padding: 20px;
    }
    .recent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .recent-title { font-size: 1rem; font-weight: 600; color: var(--color-text-primary, #111827); margin: 0; }
    .view-all-link { font-size: 0.85rem; color: #4f46e5; text-decoration: none; font-weight: 500; }
    .view-all-link:hover { text-decoration: underline; }

    .payments-list { display: flex; flex-direction: column; gap: 12px; }
    .payment-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; background: #f9fafb; border-radius: 8px;
    }
    .payment-row__icon {
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; flex-shrink: 0;
    }
    .payment-row__icon--indigo { background: #e0e7ff; }
    .payment-row__icon--green { background: #d1fae5; }
    .payment-row__icon--orange { background: #ffedd5; }
    .payment-row__info { flex: 1; min-width: 0; }
    .payment-row__desc { display: block; font-size: 0.875rem; font-weight: 500; color: var(--color-text-primary, #111827); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .payment-row__date { font-size: 0.75rem; color: var(--color-text-secondary, #6b7280); }
    .payment-row__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
    .payment-row__amount { font-size: 0.875rem; font-weight: 700; color: var(--color-text-primary, #111827); }
    .payment-status {
      font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .payment-status--captured { background: #d1fae5; color: #065f46; }
    .payment-status--created { background: #fef3c7; color: #92400e; }
    .payment-status--failed { background: #fee2e2; color: #991b1b; }
  `],
})
export class BillingOverview implements OnInit {
  billingService = inject(BillingService);
  wa = inject(WhatsappService); // ← NEW: source of truth for the WhatsApp credits card
  private accessPayment = inject(AccessPaymentService);
  private toast = inject(ToastService);

  private auth = inject(AuthService);

  canManageBilling = computed(() => this.auth.hasPermission('billing.manage'));

  isLoading = signal(true);
  cancellingAutopay = signal(false);
  recentPayments = signal<any[]>([]);
  accessStatus = this.billingService.accessStatus;

  ngOnInit(): void {
    forkJoin([
      this.billingService.loadAccessStatus(),
      this.billingService.loadWhatsappBalance(),
      this.billingService.getPaymentHistory(5, 0),
    ]).subscribe({
      next: ([, , historyRes]) => {
        if (historyRes?.payments) {
          this.recentPayments.set(historyRes.payments.slice(0, 5));
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });

    // ── WhatsApp credit balance ─────────────────────────────────────────────
    // Loaded independently (not part of the forkJoin above) so a slow or
    // failed WhatsApp balance fetch never blocks or breaks the main billing
    // page's skeleton loader. WhatsappService.balance is also the exact same
    // store BundlePaymentService refreshes right after a successful bundle
    // purchase, so this card stays in sync with the rest of the WhatsApp
    // module without needing a page reload.
    this.wa.loadBalance().subscribe();
  }

  cancelAutopay(): void {
    if (!this.canManageBilling()) return;
    if (!confirm('Cancel auto-renewal? Your current access period will remain active until it expires.')) return;
    this.cancellingAutopay.set(true);
    this.accessPayment.cancelAutopay(true).subscribe({
      next: () => this.cancellingAutopay.set(false),
      error: () => this.cancellingAutopay.set(false),
    });
  }

  formatDate(isoString: string | null | undefined): string {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return isoString; }
  }

  formatUnixDate(unixStr: string | null | undefined): string {
    if (!unixStr) return '—';
    try {
      return new Date(parseInt(unixStr, 10) * 1000).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return unixStr; }
  }

  getPaymentTypeEmoji(type: string): string {
    if (type?.includes('ACCESS')) return '🔑';
    if (type?.includes('WHATSAPP')) return '💬';
    if (type?.includes('SETUP')) return '🏫';
    return '💳';
  }

  getPaymentTypeColor(type: string): string {
    if (type?.includes('ACCESS')) return 'indigo';
    if (type?.includes('WHATSAPP')) return 'green';
    return 'orange';
  }
}