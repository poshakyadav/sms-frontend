// src/app/features/school/billing/components/access-plans/access-plans.ts

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
import { ToastService } from '../../../../../core/services/toast.service';
import { AccessPlan, BillingService } from '../../../../../core/services/billing.service';
import { AccessPaymentService } from '../../../../../core/services/access-payment.service';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-access-plans',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="plans-page">
      <!-- Header -->
      <div class="plans-header">
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
        <h1 class="plans-title">Access Plans</h1>
        <p class="plans-subtitle">Choose how you want to access the school management portal</p>
      </div>

      <!-- Current access status -->
      @if (billingService.hasAccess()) {
      <div class="current-access-banner">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Current access expires in
        <strong
          >{{ billingService.daysRemaining() }}
          {{ billingService.daysRemaining() === 1 ? 'day' : 'days' }}</strong
        >
        — purchasing a plan will stack on top of remaining days.
      </div>
      }

      <!-- Payment mode toggle -->
      <div class="mode-toggle">
        <button
          class="mode-btn"
          [class.mode-btn--active]="paymentMode() === 'manual'"
          (click)="setMode('manual')"
        >
          Pay Once
        </button>
        <button
          class="mode-btn"
          [class.mode-btn--active]="paymentMode() === 'autopay'"
          (click)="setMode('autopay')"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 4v6h6" />
            <path d="M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          UPI Autopay
        </button>
      </div>

      <!-- Autopay info callout -->
      @if (paymentMode() === 'autopay') {
      <div class="autopay-info">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <strong>UPI Autopay:</strong> Set up once, pay automatically each cycle. A small
          authorisation charge is made now (auto-refunded by Razorpay within 2 business days) to
          register your UPI mandate. You can cancel anytime from the Billing page.
        </div>
      </div>
      } @if (!canPurchase()) {
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
        You can view plans, but only users with billing permissions can complete a purchase.
      </div>
      }

      <!-- Loading -->
      @if (isLoading()) {
      <div class="plans-loading">
        <div class="skeleton-plan"></div>
        <div class="skeleton-plan"></div>
      </div>
      }

      <!-- Plan Cards -->
      @if (!isLoading()) {
      <div class="plan-cards">
        @for (plan of plans(); track plan.id) {
        <div
          class="plan-card"
          [class.plan-card--selected]="selectedPlan() === plan.planType"
          [class.plan-card--yearly]="plan.planType === 'YEARLY'"
        >
          @if (plan.planType === 'YEARLY') {
          <div class="plan-card__badge">
            Best Value — Save {{ yearlySavings(plan) | number : '1.0-0' }}%
          </div>
          }

          <div class="plan-card__header">
            <div>
              <h2 class="plan-card__name">{{ plan.name }}</h2>
              <p class="plan-card__duration">
                {{ plan.planType === 'MONTHLY' ? '30 days' : '365 days' }} of full access
              </p>
            </div>
            <div class="plan-card__price">
              @if (plan.discountPaise > 0) {
              <span class="plan-card__original"
                >₹{{ plan.amountPaise / 100 | number : '1.0-0' }}</span
              >
              }
              <span class="plan-card__amount"
                >₹{{ plan.finalAmountPaise / 100 | number : '1.0-0' }}</span
              >
              <span class="plan-card__period"
                >/ {{ plan.planType === 'MONTHLY' ? 'month' : 'year' }}</span
              >
            </div>
          </div>

          @if (plan.planType === 'YEARLY') {
          <p class="plan-card__equiv">
            Equivalent to ₹{{ plan.finalAmountPaise / 100 / 12 | number : '1.0-2' }}/month
          </p>
          }

          <ul class="plan-card__features">
            <li>✓ All school management features</li>
            <li>✓ Unlimited students, parents & staff</li>
            <li>✓ Fee management, attendance, exams</li>
            <li>✓ Notifications & WhatsApp messaging</li>
            @if (plan.planType === 'YEARLY') {
            <li>✓ Priority support</li>
            }
          </ul>

          @if (paymentMode() === 'autopay' && !plan.autopayEnabled) {
          <p class="plan-card__autopay-disabled">
            UPI Autopay not available for this plan currently
          </p>
          }

          <button
            class="plan-card__cta"
            [class.plan-card__cta--primary]="plan.planType === 'YEARLY'"
            [disabled]="
              !canPurchase() ||
              isPaymentInProgress() ||
              (paymentMode() === 'autopay' && !plan.autopayEnabled)
            "
            [title]="!canPurchase() ? 'Contact your school admin to manage billing' : ''"
            (click)="purchasePlan(plan)"
          >
            @if (isPaymentInProgress() && selectedPlan() === plan.planType) {
            <span class="btn-spinner"></span>
            {{ processingLabel() }}
            } @else { @if (paymentMode() === 'manual') { Pay ₹{{
              plan.finalAmountPaise / 100 | number : '1.0-0'
            }}
            } @else { Set Up Auto-Pay (₹{{ plan.finalAmountPaise / 100 | number : '1.0-0' }}/{{
              plan.planType === 'MONTHLY' ? 'mo' : 'yr'
            }}) } }
          </button>
        </div>
        }
      </div>
      }

      <!-- Footer note -->
      <p class="plans-footer-note">
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
        Payments secured by Razorpay. All transactions use SSL encryption. GST will be added as
        applicable.
      </p>
    </div>
  `,
  styles: [
    `
      .plans-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px 20px 64px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .plans-header {
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
      .plans-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text-primary, #111827);
        margin: 0;
      }
      .plans-subtitle {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6b7280);
        margin: 0;
      }

      .current-access-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        border-radius: 8px;
        background: #ecfdf5;
        color: #065f46;
        font-size: 0.875rem;
        border: 1px solid #a7f3d0;
      }

      .mode-toggle {
        display: flex;
        background: #f3f4f6;
        border-radius: 8px;
        padding: 4px;
        gap: 4px;
        width: fit-content;
      }
      .mode-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        border: none;
        background: transparent;
        color: var(--color-text-secondary, #6b7280);
        cursor: pointer;
        transition: all 0.15s;
      }
      .mode-btn--active {
        background: #fff;
        color: #4f46e5;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        font-weight: 600;
      }

      .autopay-info {
        display: flex;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        background: #eff6ff;
        color: #1e40af;
        font-size: 0.85rem;
        border: 1px solid #bfdbfe;
        line-height: 1.5;
      }
      .autopay-info svg {
        flex-shrink: 0;
        margin-top: 2px;
      }

      /* Skeletons */
      .plans-loading {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      .skeleton-plan {
        height: 360px;
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

      /* Plan cards */
      .plan-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      @media (max-width: 640px) {
        .plan-cards {
          grid-template-columns: 1fr;
        }
        .plans-loading {
          grid-template-columns: 1fr;
        }
      }

      .plan-card {
        position: relative;
        background: #fff;
        border: 2px solid var(--color-border, #e5e7eb);
        border-radius: 14px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .plan-card:hover {
        border-color: #a5b4fc;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1);
      }
      .plan-card--yearly {
        border-color: #6366f1;
      }
      .plan-card--selected {
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
      }

      .plan-card__badge {
        position: absolute;
        top: -12px;
        right: 16px;
        padding: 3px 12px;
        border-radius: 99px;
        background: #4f46e5;
        color: #fff;
        font-size: 0.75rem;
        font-weight: 700;
      }

      .plan-card__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .plan-card__name {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-primary, #111827);
        margin: 0 0 4px;
      }
      .plan-card__duration {
        font-size: 0.8rem;
        color: var(--color-text-secondary, #6b7280);
        margin: 0;
      }
      .plan-card__price {
        text-align: right;
        flex-shrink: 0;
      }
      .plan-card__original {
        display: block;
        font-size: 0.8rem;
        color: #9ca3af;
        text-decoration: line-through;
      }
      .plan-card__amount {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--color-text-primary, #111827);
      }
      .plan-card__period {
        font-size: 0.8rem;
        color: var(--color-text-secondary, #6b7280);
      }
      .plan-card__equiv {
        font-size: 0.8rem;
        color: #6366f1;
        font-weight: 500;
        margin: -8px 0 0;
      }

      .plan-card__features {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .plan-card__features li {
        font-size: 0.85rem;
        color: var(--color-text-secondary, #374151);
      }

      .plan-card__autopay-disabled {
        font-size: 0.8rem;
        color: #9ca3af;
        font-style: italic;
        margin: 0;
      }

      .plan-card__cta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        background: #f3f4f6;
        color: var(--color-text-primary, #111827);
        border: none;
        cursor: pointer;
        transition: all 0.15s;
        margin-top: auto;
      }
      .plan-card__cta:hover:not(:disabled) {
        background: #e5e7eb;
      }
      .plan-card__cta--primary {
        background: #4f46e5;
        color: #fff;
      }
      .plan-card__cta--primary:hover:not(:disabled) {
        background: #4338ca;
      }
      .plan-card__cta:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-spinner {
        width: 16px;
        height: 16px;
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

      .plans-footer-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--color-text-secondary, #9ca3af);
        text-align: center;
        justify-content: center;
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
    `,
  ],
})
export class AccessPlans implements OnInit {
  billingService = inject(BillingService);
  private accessPayment = inject(AccessPaymentService);
  private toast = inject(ToastService);

  private auth = inject(AuthService);

  canPurchase = computed(() => this.auth.hasPermission('billing.manage'));

  isLoading = signal(true);
  plans = signal<AccessPlan[]>([]);
  paymentMode = signal<'manual' | 'autopay'>('manual');
  selectedPlan = signal<'MONTHLY' | 'YEARLY' | null>(null);

  isPaymentInProgress = computed(() => this.accessPayment.isProcessing());
  processingLabel = computed(() => {
    switch (this.accessPayment.processingStep()) {
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

  ngOnInit(): void {
    this.billingService.getAvailablePlans().subscribe({
      next: (res) => {
        if (res.success) this.plans.set(res.plans);
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load plans. Please refresh.');
        this.isLoading.set(false);
      },
    });

    // Also load current access status for the banner
    this.billingService.loadAccessStatus().subscribe();
  }

  setMode(mode: 'manual' | 'autopay'): void {
    this.paymentMode.set(mode);
  }

  async purchasePlan(plan: AccessPlan): Promise<void> {
    if (!this.canPurchase()) {
      this.toast.error('You do not have permission to manage billing. Contact your school admin.');
      return;
    }
    if (this.accessPayment.isProcessing()) return;
    this.selectedPlan.set(plan.planType);

    try {
      if (this.paymentMode() === 'autopay') {
        await this.accessPayment.initiateAutopayPayment(plan.planType);
      } else {
        await this.accessPayment.initiateManualPayment(plan.planType);
      }
      // Success handled inside service (toast + signal refresh)
    } catch (err: any) {
      if (err?.message && !err.message.includes('dismissed')) {
        this.toast.error(err.message || 'Payment failed. Please try again.');
      }
    } finally {
      this.selectedPlan.set(null);
    }
  }

  yearlySavings(plan: AccessPlan): number {
    // Compare yearly final amount vs 12x monthly final amount
    const monthlyPlan = this.plans().find((p) => p.planType === 'MONTHLY');
    if (!monthlyPlan) return 0;
    const monthlyAnnual = monthlyPlan.finalAmountPaise * 12;
    const savings = ((monthlyAnnual - plan.finalAmountPaise) / monthlyAnnual) * 100;
    return Math.max(0, savings);
  }
}
