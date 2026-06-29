// src/app/features/school/billing/components/payment-history/payment-history.ts

import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ToastService } from '../../../../../core/services/toast.service';
import { AccessPeriod, BillingService, BundlePurchaseHistory, PlatformPayment } from '../../../../../core/services/billing.service';

type TabKey = 'payments' | 'access' | 'bundles';

const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'ACCESS_MONTHLY', label: 'Monthly Access' },
  { value: 'ACCESS_YEARLY', label: 'Yearly Access' },
  { value: 'WHATSAPP_BUNDLE', label: 'WhatsApp Bundle' },
  { value: 'SCHOOL_SETUP_FEE', label: 'Setup Fee' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'CREATED', label: 'Created' },
  { value: 'AUTHORIZED', label: 'Authorized' },
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const PAGE_SIZE = 20;

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="history-page">
      <!-- Header -->
      <div class="history-header">
        <a routerLink="../" class="back-link">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Billing
        </a>
        <h1 class="history-title">Payment History</h1>
        <p class="history-subtitle">
          Every payment, access period, and credit purchase for your school
        </p>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab"
          [class.tab--active]="activeTab() === 'payments'"
          (click)="switchTab('payments')"
        >
          Payments
        </button>
        <button
          class="tab"
          [class.tab--active]="activeTab() === 'access'"
          (click)="switchTab('access')"
        >
          Access History
        </button>
        <button
          class="tab"
          [class.tab--active]="activeTab() === 'bundles'"
          (click)="switchTab('bundles')"
        >
          WhatsApp Credits
        </button>
      </div>

      <!-- ── PAYMENTS TAB ──────────────────────────────────────────────── -->
      @if (activeTab() === 'payments') {

      <div class="filters">
        <select
          class="filter-select"
          [value]="paymentTypeFilter()"
          (change)="onTypeFilterChange($any($event.target).value)"
        >
          @for (opt of paymentTypeOptions; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
        <select
          class="filter-select"
          [value]="statusFilter()"
          (change)="onStatusFilterChange($any($event.target).value)"
        >
          @for (opt of statusOptions; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </div>

      @if (isLoadingPayments()) {
      <div class="list-skeleton">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
      } @else if (payments().length === 0) {
      <div class="empty-state">No payments found for the selected filters.</div>
      } @else {
      <div class="payments-list">
        @for (payment of payments(); track payment.id) {
        <div class="payment-row">
          <div
            class="payment-row__icon"
            [class]="'payment-row__icon--' + typeColor(payment.paymentType)"
          >
            {{ typeEmoji(payment.paymentType) }}
          </div>
          <div class="payment-row__info">
            <span class="payment-row__desc">{{ payment.description }}</span>
            <span class="payment-row__date"
              >{{ formatDate(payment.capturedAt || payment.createdAt) }} ·
              {{ payment.source === 'AUTOPAY_CHARGE' ? 'Auto-renewal' : 'Manual payment' }}</span
            >
          </div>
          <div class="payment-row__right">
            <span class="payment-row__amount">{{ formatRupees(payment.amountPaise) }}</span>
            <span
              class="payment-status"
              [class]="'payment-status--' + payment.status.toLowerCase()"
              >{{ payment.status }}</span
            >
          </div>
        </div>
        }
      </div>

      @if (paymentsHasMore()) {
      <button class="load-more-btn" [disabled]="isLoadingMore()" (click)="loadMorePayments()">
        {{ isLoadingMore() ? 'Loading…' : 'Load more' }}
      </button>
      } } }

      <!-- ── ACCESS HISTORY TAB ────────────────────────────────────────── -->
      @if (activeTab() === 'access') { @if (isLoadingAccess()) {
      <div class="list-skeleton">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
      } @else if (accessPeriods().length === 0) {
      <div class="empty-state">No access periods recorded yet.</div>
      } @else {
      <div class="payments-list">
        @for (period of accessPeriods(); track period.id) {
        <div class="payment-row">
          <div class="payment-row__icon payment-row__icon--indigo">🔑</div>
          <div class="payment-row__info">
            <span class="payment-row__desc"
              >{{ period.planType }} access —
              {{ period.source === 'AUTOPAY_CHARGE' ? 'Auto-renewal' : 'Manual payment' }}</span
            >
            <span class="payment-row__date"
              >{{ formatDate(period.startsAt) }} → {{ formatDate(period.expiresAt) }}</span
            >
            @if (period.notes) {
            <span class="payment-row__note">{{ period.notes }}</span>
            }
          </div>
        </div>
        }
      </div>
      } }

      <!-- ── BUNDLE HISTORY TAB ────────────────────────────────────────── -->
      @if (activeTab() === 'bundles') { @if (isLoadingBundles()) {
      <div class="list-skeleton">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
      } @else if (bundleHistory().length === 0) {
      <div class="empty-state">No WhatsApp credit purchases yet.</div>
      } @else {
      <div class="payments-list">
        @for (bundle of bundleHistory(); track bundle.id) {
        <div class="payment-row">
          <div class="payment-row__icon payment-row__icon--green">💬</div>
          <div class="payment-row__info">
            <span class="payment-row__desc"
              >{{ bundle.bundleName || 'WhatsApp Bundle' }} — +{{
                bundle.creditsAdded | number
              }}
              credits</span
            >
            <span class="payment-row__date"
              >{{ formatDate(bundle.createdAt) }} · expires {{ formatDate(bundle.expiresAt) }}</span
            >
          </div>
          <div class="payment-row__right">
            <span class="payment-row__amount">{{ formatRupees(bundle.amountPaise) }}</span>
            <span
              class="payment-status"
              [class]="'payment-status--' + bundle.status.toLowerCase()"
              >{{ bundle.status }}</span
            >
          </div>
        </div>
        }
      </div>
      } }
    </div>
  `,
  styles: [
    `
      .history-page {
        max-width: 900px;
        margin: 0 auto;
        padding: 24px 20px 64px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .history-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        color: var(--color-text-secondary, #6b7280);
        text-decoration: none;
        width: fit-content;
        margin-bottom: 8px;
      }
      .back-link:hover {
        color: #4f46e5;
      }
      .history-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text-primary, #111827);
        margin: 0;
      }
      .history-subtitle {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6b7280);
        margin: 0;
      }

      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--color-border, #e5e7eb);
      }
      .tab {
        padding: 10px 16px;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary, #6b7280);
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: all 0.15s;
      }
      .tab:hover {
        color: var(--color-text-primary, #111827);
      }
      .tab--active {
        color: #4f46e5;
        border-bottom-color: #4f46e5;
        font-weight: 600;
      }

      .filters {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .filter-select {
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        border: 1px solid var(--color-border, #e5e7eb);
        background: #fff;
        color: var(--color-text-primary, #111827);
        cursor: pointer;
      }

      .list-skeleton {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .skeleton-row {
        height: 64px;
        border-radius: 8px;
        background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
      }
      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      .empty-state {
        padding: 32px;
        text-align: center;
        border-radius: 12px;
        background: var(--color-bg-subtle, #f9fafb);
        color: var(--color-text-secondary, #6b7280);
        font-size: 0.9rem;
      }

      .payments-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .payment-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: #f9fafb;
        border-radius: 8px;
      }
      .payment-row__icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        flex-shrink: 0;
        background: #e5e7eb;
      }
      .payment-row__icon--indigo {
        background: #e0e7ff;
      }
      .payment-row__icon--green {
        background: #d1fae5;
      }
      .payment-row__icon--orange {
        background: #ffedd5;
      }
      .payment-row__info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .payment-row__desc {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary, #111827);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .payment-row__date {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #6b7280);
      }
      .payment-row__note {
        font-size: 0.75rem;
        color: #9ca3af;
        font-style: italic;
        margin-top: 2px;
      }
      .payment-row__right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        flex-shrink: 0;
      }
      .payment-row__amount {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--color-text-primary, #111827);
      }
      .payment-status {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 99px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .payment-status--captured,
      .payment-status--active {
        background: #d1fae5;
        color: #065f46;
      }
      .payment-status--created,
      .payment-status--pending {
        background: #fef3c7;
        color: #92400e;
      }
      .payment-status--failed {
        background: #fee2e2;
        color: #991b1b;
      }
      .payment-status--refunded,
      .payment-status--expired {
        background: #f3f4f6;
        color: #6b7280;
      }

      .load-more-btn {
        align-self: center;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #4f46e5;
        background: #eef2ff;
        border: none;
        cursor: pointer;
      }
      .load-more-btn:hover:not(:disabled) {
        background: #e0e7ff;
      }
      .load-more-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class PaymentHistory implements OnInit {
  private billingService = inject(BillingService);
  private toast = inject(ToastService);

  readonly paymentTypeOptions = PAYMENT_TYPE_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;

  activeTab = signal<TabKey>('payments');

  // Payments tab
  payments = signal<PlatformPayment[]>([]);
  paymentsOffset = signal(0);
  paymentsHasMore = signal(true);
  paymentTypeFilter = signal('');
  statusFilter = signal('');
  isLoadingPayments = signal(true);
  isLoadingMore = signal(false);

  // Access history tab
  accessPeriods = signal<AccessPeriod[]>([]);
  isLoadingAccess = signal(false);
  private accessLoaded = signal(false);

  // Bundle history tab
  bundleHistory = signal<BundlePurchaseHistory[]>([]);
  isLoadingBundles = signal(false);
  private bundlesLoaded = signal(false);

  ngOnInit(): void {
    this.loadPayments(true);
  }

  switchTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (tab === 'access' && !this.accessLoaded()) this.loadAccessHistory();
    if (tab === 'bundles' && !this.bundlesLoaded()) this.loadBundleHistory();
  }

  onTypeFilterChange(value: string): void {
    this.paymentTypeFilter.set(value);
    this.loadPayments(true);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.loadPayments(true);
  }

  loadPayments(reset: boolean): void {
    const offset = reset ? 0 : this.paymentsOffset();
    reset ? this.isLoadingPayments.set(true) : this.isLoadingMore.set(true);

    this.billingService
      .getPaymentHistory(
        PAGE_SIZE,
        offset,
        this.paymentTypeFilter() || undefined,
        this.statusFilter() || undefined
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            const rows: PlatformPayment[] = res.payments ?? [];
            this.payments.set(reset ? rows : [...this.payments(), ...rows]);
            this.paymentsOffset.set(offset + rows.length);
            this.paymentsHasMore.set(rows.length === PAGE_SIZE);
          }
          this.isLoadingPayments.set(false);
          this.isLoadingMore.set(false);
        },
        error: () => {
          this.toast.error('Failed to load payment history.');
          this.isLoadingPayments.set(false);
          this.isLoadingMore.set(false);
        },
      });
  }

  loadMorePayments(): void {
    this.loadPayments(false);
  }

  loadAccessHistory(): void {
    this.isLoadingAccess.set(true);
    this.billingService.getAccessHistory().subscribe({
      next: (res) => {
        if (res.success) this.accessPeriods.set(res.periods ?? []);
        this.accessLoaded.set(true);
        this.isLoadingAccess.set(false);
      },
      error: () => {
        this.toast.error('Failed to load access history.');
        this.isLoadingAccess.set(false);
      },
    });
  }

  loadBundleHistory(): void {
    this.isLoadingBundles.set(true);
    this.billingService.getBundleHistory('WHATSAPP').subscribe({
      next: (res) => {
        if (res.success) this.bundleHistory.set(res.history ?? []);
        this.bundlesLoaded.set(true);
        this.isLoadingBundles.set(false);
      },
      error: () => {
        this.toast.error('Failed to load bundle history.');
        this.isLoadingBundles.set(false);
      },
    });
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  formatRupees(paise: number | null | undefined): string {
    if (paise === null || paise === undefined) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  typeEmoji(type: string): string {
    if (type?.includes('ACCESS')) return '🔑';
    if (type?.includes('WHATSAPP')) return '💬';
    if (type?.includes('SETUP')) return '🏫';
    return '💳';
  }

  typeColor(type: string): string {
    if (type?.includes('ACCESS')) return 'indigo';
    if (type?.includes('WHATSAPP')) return 'green';
    return 'orange';
  }
}
