// src/app/features/school/billing/services/billing.service.ts
//
// Read-only billing data service. These endpoints are intentionally
// NOT behind requireActiveAccess (so an expired school can still see
// their status and renew). Called from billing overview + history views.

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from './api.service';

// ── Response shapes (mirror backend) ─────────────────────────────────────────

export interface AccessStatus {
  hasAccess: boolean;
  expiresAt: string | null;
  daysRemaining: number;
  autopay: AutopayInfo | null;
}

export interface AutopayInfo {
  id: number;
  planType: 'MONTHLY' | 'YEARLY';
  status: string; // created | authenticated | active | pending | halted | cancelled | completed
  nextChargeAt: string | null;
  paidCount: number;
}

export interface AccessPlan {
  id: number;
  planType: 'MONTHLY' | 'YEARLY';
  name: string;
  amountPaise: number;
  discountPaise: number;
  finalAmountPaise: number;
  durationDays: number;
  autopayEnabled: boolean;
  isActive: boolean;
}

export interface PlatformPayment {
  id: number;
  paymentType: string;
  source: string;
  amountPaise: number;
  currency: string;
  status: string;
  method: string | null;
  description: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface AccessPeriod {
  id: number;
  planType: string;
  source: string;
  startsAt: string;
  expiresAt: string;
  notes: string | null;
  createdAt: string;
}

export interface WhatsappBalance {
  totalCreditsEverPurchased: number;
  creditsUsed: number;
  creditsRemaining: number;
  lastPurchaseAt: string | null;
}

export interface BundlePurchaseHistory {
  id: number;
  channel: string;
  creditsAdded: number;
  expiresAt: string;
  status: string;
  createdAt: string;
  bundleName: string | null;
  amountPaise: number | null;
}

export interface MessageBundle {
  id: number;
  channel: string;
  name: string;
  messageCount: number;
  amountPaise: number;
  discountPaise: number;
  finalAmountPaise: number;
  validityDays: number;
  sortOrder: number;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BillingService {
  private api = inject(ApiService);

  // ── Reactive state signals ────────────────────────────────────────────────
  accessStatus = signal<AccessStatus | null>(null);
  whatsappBalance = signal<WhatsappBalance | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Computed convenience signals
  hasAccess = computed(() => this.accessStatus()?.hasAccess ?? false);
  daysRemaining = computed(() => this.accessStatus()?.daysRemaining ?? 0);
  isExpiringSoon = computed(() => {
    const days = this.daysRemaining();
    return days > 0 && days <= 7;
  });
  isExpired = computed(() => {
    const status = this.accessStatus();
    return status !== null && !status.hasAccess;
  });
  autopayActive = computed(() => {
    const ap = this.accessStatus()?.autopay;
    return (
      ap !== null && ap !== undefined && ['active', 'authenticated', 'created'].includes(ap.status)
    );
  });
  whatsappCreditsRemaining = computed(() => this.whatsappBalance()?.creditsRemaining ?? 0);

  // ── Expiry banner support ───────────────────────────────────────────────
  // Populated by the auth interceptor from the `X-Access-Expires-In-Days`
  // response header. The backend attaches this header to ANY authenticated
  // school request (not just billing endpoints) once access is within 7
  // days of expiring — so the banner can appear on first page load, before
  // the billing module has ever been opened.
  private headerExpiresInDays = signal<number | null>(null);

  setExpiresInDaysFromHeader(days: number): void {
    this.headerExpiresInDays.set(days);
  }

  /** Prefers the full access-status fetch (authoritative) over the header signal. */
  effectiveDaysRemaining = computed<number | null>(() => {
    const status = this.accessStatus();
    if (status) return status.daysRemaining;
    return this.headerExpiresInDays();
  });

  showExpiryBanner = computed(() => {
    const days = this.effectiveDaysRemaining();
    return days !== null && days > 0 && days <= 7;
  });

  // ── API calls ─────────────────────────────────────────────────────────────

  loadAccessStatus(): Observable<any> {
    return this.api.get<any>('school/billing/access-status').pipe(
      tap((res) => {
        if (res.success) {
          this.accessStatus.set({
            hasAccess: res.hasAccess,
            expiresAt: res.expiresAt,
            daysRemaining: res.daysRemaining,
            autopay: res.autopay,
          });
        }
      })
    );
  }

  loadWhatsappBalance(): Observable<any> {
    return this.api.get<any>('school/billing/balance/whatsapp').pipe(
      tap((res) => {
        if (res.success) {
          this.whatsappBalance.set(res.balance);
        }
      })
    );
  }

  getPaymentHistory(
    limit = 20,
    offset = 0,
    paymentType?: string,
    status?: string
  ): Observable<any> {
    let params = new HttpParams().set('limit', limit.toString()).set('offset', offset.toString());
    if (paymentType) params = params.set('paymentType', paymentType);
    if (status) params = params.set('status', status);
    return this.api.get<any>('school/billing/history', params);
  }

  getAccessHistory(): Observable<any> {
    return this.api.get<any>('school/billing/access-history');
  }

  getBundleHistory(channel?: string): Observable<any> {
    let params = new HttpParams();
    if (channel) params = params.set('channel', channel);
    return this.api.get<any>('school/billing/bundles', params);
  }

  getAvailablePlans(): Observable<any> {
    return this.api.get<any>('school/payments/access/plans');
  }

  getAvailableBundles(channel: 'WHATSAPP' | 'EMAIL' | 'SMS'): Observable<any> {
    const params = new HttpParams().set('channel', channel);
    return this.api.get<any>('school/payments/bundles', params);
  }
}
