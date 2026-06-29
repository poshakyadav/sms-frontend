// src/app/features/school/billing/components/bundle-purchase/bundle-purchase.ts

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
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { BillingService, MessageBundle } from '../../../../../core/services/billing.service';
import { BundlePaymentService } from '../../../../../core/services/bundle-payment.service';

@Component({
  selector: 'app-bundle-purchase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bundles-page">
      <!-- Header -->
      <div class="bundles-header">
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
        <h1 class="bundles-title">WhatsApp Message Credits</h1>
        <p class="bundles-subtitle">
          Buy prepaid credit packs to send WhatsApp notifications to parents and students
        </p>
      </div>

      <!-- Current balance summary -->
      <div class="balance-banner">
        <div class="balance-banner__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
            />
            <path
              d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.529 5.845L.057 23.428c-.093.337.009.697.263.93a.93.93 0 0 0 .938.149l5.745-1.508A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.069a10.01 10.01 0 0 1-5.229-1.474l-.375-.222-3.861 1.013 1.033-3.752-.244-.392A10.015 10.015 0 0 1 1.931 12C1.931 6.427 6.427 1.931 12 1.931S22.069 6.427 22.069 12 17.573 22.069 12 22.069z"
            />
          </svg>
        </div>
        <div class="balance-banner__info">
          <span class="balance-banner__count">{{
            (billingService.whatsappCreditsRemaining() | number) ?? 0
          }}</span>
          <span class="balance-banner__label">credits remaining</span>
        </div>
        <a routerLink="../history" class="balance-banner__link">View purchase history →</a>
      </div>

      @if (!canPurchase()) {
      <div class="permission-note">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        You can view bundles, but only users with billing permissions can complete a purchase.
        Contact your school admin.
      </div>
      }

      <!-- Loading -->
      @if (isLoading()) {
      <div class="bundles-loading">
        <div class="skeleton-bundle"></div>
        <div class="skeleton-bundle"></div>
        <div class="skeleton-bundle"></div>
        <div class="skeleton-bundle"></div>
      </div>
      }

      <!-- Bundle Cards -->
      @if (!isLoading()) { @if (bundles().length === 0) {
      <div class="empty-state">
        No WhatsApp bundles are available right now. Please check back later.
      </div>
      } @else {
      <div class="bundle-cards">
        @for (bundle of bundles(); track bundle.id) {
        <div class="bundle-card" [class.bundle-card--best]="bundle.id === bestValueBundleId()">
          @if (bundle.id === bestValueBundleId()) {
          <div class="bundle-card__badge">Best Value</div>
          }

          <div class="bundle-card__count">{{ bundle.messageCount | number }}</div>
          <div class="bundle-card__count-label">messages</div>

          <div class="bundle-card__price">
            @if (bundle.discountPaise > 0) {
            <span class="bundle-card__original">₹{{ formatPaise(bundle.amountPaise) }}</span>
            }
            <span class="bundle-card__amount">₹{{ formatPaise(bundle.finalAmountPaise) }}</span>
          </div>
          <p class="bundle-card__rate">≈ ₹{{ perMessageCost(bundle).toFixed(2) }} / message</p>

          <p class="bundle-card__validity">
            Valid for {{ bundle.validityDays }} days from purchase
          </p>

          <button
            class="bundle-card__cta"
            [class.bundle-card__cta--primary]="bundle.id === bestValueBundleId()"
            [disabled]="!canPurchase() || isPurchaseInProgress()"
            [title]="!canPurchase() ? 'Contact your school admin to manage billing' : ''"
            (click)="purchase(bundle)"
          >
            @if (isPurchaseInProgress() && selectedBundleId() === bundle.id) {
            <span class="btn-spinner"></span>
            {{ processingLabel() }}
            } @else { Buy for ₹{{ formatPaise(bundle.finalAmountPaise) }}
            }
          </button>
        </div>
        }
      </div>
      } }

      <p class="bundles-footer-note">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Credits never expire mid-conversation and are deducted only on successful send. Payments
        secured by Razorpay.
      </p>
    </div>
  `,
  styles: [
    `
      .bundles-page {
        max-width: 900px;
        margin: 0 auto;
        padding: 24px 20px 64px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .bundles-header {
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
      .bundles-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text-primary, #111827);
        margin: 0;
      }
      .bundles-subtitle {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6b7280);
        margin: 0;
      }

      .balance-banner {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 20px;
        border-radius: 12px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
      }
      .balance-banner__icon {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #d1fae5;
        color: #059669;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .balance-banner__info {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .balance-banner__count {
        font-size: 1.25rem;
        font-weight: 700;
        color: #065f46;
        line-height: 1.1;
      }
      .balance-banner__label {
        font-size: 0.75rem;
        color: #047857;
      }
      .balance-banner__link {
        font-size: 0.825rem;
        font-weight: 600;
        color: #047857;
        text-decoration: none;
        white-space: nowrap;
      }
      .balance-banner__link:hover {
        text-decoration: underline;
      }

      .permission-note {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 8px;
        background: #fff7ed;
        color: #9a3412;
        font-size: 0.8rem;
        border: 1px solid #fed7aa;
      }

      .empty-state {
        padding: 32px;
        text-align: center;
        border-radius: 12px;
        background: var(--color-bg-subtle, #f9fafb);
        color: var(--color-text-secondary, #6b7280);
        font-size: 0.9rem;
      }

      /* Skeletons */
      .bundles-loading {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      .skeleton-bundle {
        height: 240px;
        border-radius: 12px;
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

      /* Bundle cards */
      .bundle-cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
      @media (max-width: 900px) {
        .bundle-cards {
          grid-template-columns: repeat(2, 1fr);
        }
        .bundles-loading {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 480px) {
        .bundle-cards {
          grid-template-columns: 1fr;
        }
        .bundles-loading {
          grid-template-columns: 1fr;
        }
      }

      .bundle-card {
        position: relative;
        background: #fff;
        border: 2px solid var(--color-border, #e5e7eb);
        border-radius: 14px;
        padding: 22px 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 6px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .bundle-card:hover {
        border-color: #a5b4fc;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.1);
      }
      .bundle-card--best {
        border-color: #4f46e5;
      }

      .bundle-card__badge {
        position: absolute;
        top: -11px;
        padding: 3px 12px;
        border-radius: 99px;
        background: #4f46e5;
        color: #fff;
        font-size: 0.7rem;
        font-weight: 700;
      }

      .bundle-card__count {
        font-size: 1.85rem;
        font-weight: 800;
        color: var(--color-text-primary, #111827);
        margin-top: 8px;
      }
      .bundle-card__count-label {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #6b7280);
        margin-top: -6px;
      }

      .bundle-card__price {
        margin-top: 10px;
      }
      .bundle-card__original {
        display: block;
        font-size: 0.8rem;
        color: #9ca3af;
        text-decoration: line-through;
      }
      .bundle-card__amount {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--color-text-primary, #111827);
      }
      .bundle-card__rate {
        font-size: 0.75rem;
        color: #6366f1;
        margin: 0;
        font-weight: 500;
      }
      .bundle-card__validity {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #9ca3af);
        margin: 0 0 6px;
      }

      .bundle-card__cta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 11px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        background: #f3f4f6;
        color: var(--color-text-primary, #111827);
        border: none;
        cursor: pointer;
        transition: all 0.15s;
        margin-top: 8px;
      }
      .bundle-card__cta:hover:not(:disabled) {
        background: #e5e7eb;
      }
      .bundle-card__cta--primary {
        background: #4f46e5;
        color: #fff;
      }
      .bundle-card__cta--primary:hover:not(:disabled) {
        background: #4338ca;
      }
      .bundle-card__cta:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: currentColor;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .bundles-footer-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--color-text-secondary, #9ca3af);
        text-align: center;
        justify-content: center;
      }
    `,
  ],
})
export class BundlePurchase implements OnInit {
  billingService = inject(BillingService);
  private bundlePayment = inject(BundlePaymentService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  isLoading = signal(true);
  bundles = signal<MessageBundle[]>([]);
  selectedBundleId = signal<number | null>(null);

  canPurchase = computed(() => this.auth.hasPermission('billing.manage'));
  isPurchaseInProgress = computed(() => this.bundlePayment.isProcessing());
  processingLabel = computed(() => {
    switch (this.bundlePayment.processingStep()) {
      case 'initiating':
        return 'Creating order…';
      case 'checkout':
        return 'Processing…';
      case 'verifying':
        return 'Confirming payment…';
      default:
        return 'Processing…';
    }
  });

  // Lowest paise-per-message bundle is flagged "Best Value"
  bestValueBundleId = computed<number | null>(() => {
    const list = this.bundles();
    if (list.length === 0) return null;
    let best = list[0];
    for (const b of list) {
      if (this.perMessageCost(b) < this.perMessageCost(best)) best = b;
    }
    return best.id;
  });

  ngOnInit(): void {
    this.billingService.loadWhatsappBalance().subscribe();
    this.billingService.getAvailableBundles('WHATSAPP').subscribe({
      next: (res) => {
        if (res.success) this.bundles.set(res.bundles ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load bundles. Please refresh.');
        this.isLoading.set(false);
      },
    });
  }

  perMessageCost(bundle: MessageBundle): number {
    if (bundle.messageCount <= 0) return Infinity;
    return bundle.finalAmountPaise / bundle.messageCount / 100;
  }

  formatPaise(paise: number): string {
    return (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  async purchase(bundle: MessageBundle): Promise<void> {
    if (!this.canPurchase()) {
      this.toast.error(
        'You do not have permission to purchase credits. Contact your school admin.'
      );
      return;
    }
    if (this.bundlePayment.isProcessing()) return;

    this.selectedBundleId.set(bundle.id);
    try {
      await this.bundlePayment.purchaseBundle(bundle.id, bundle.name);
    } catch (err: any) {
      if (err?.message && !err.message.includes('dismissed')) {
        this.toast.error(err.message || 'Purchase failed. Please try again.');
      }
    } finally {
      this.selectedBundleId.set(null);
    }
  }
}
