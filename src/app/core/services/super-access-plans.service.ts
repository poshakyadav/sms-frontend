// src/app/core/services/super-access-plans.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface SuperAccessPlan {
  id: number;
  planType: 'MONTHLY' | 'YEARLY';
  name: string;
  amountPaise: number;
  discountPaise: number;
  finalAmountPaise: number;
  durationDays: number;
  autopayEnabled: boolean;
  isActive: boolean;
  razorpayPlanId: string | null;
  activeAutopaySubscriptions: number;
  updatedAt: string;
  createdAt: string;
}

export interface UpdateAccessPlanInput {
  name?: string;
  amountPaise?: number;
  discountPaise?: number;
  autopayEnabled?: boolean;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SuperAccessPlansService {
  private api = inject(ApiService);

  plans = signal<SuperAccessPlan[]>([]);
  isLoading = signal(false);
  isInitializing = signal(false);

  loadPlans(): Observable<any> {
    this.isLoading.set(true);
    return this.api.get<any>('super/access-plans').pipe(
      tap((res) => {
        if (res.success) this.plans.set(res.plans);
        this.isLoading.set(false);
      })
    );
  }

  updatePlan(planType: 'MONTHLY' | 'YEARLY', input: UpdateAccessPlanInput): Observable<any> {
    return this.api.put<any>(`super/access-plans/${planType}`, input).pipe(
      tap((res) => {
        if (res.success) {
          this.plans.update((plans) =>
            plans.map((p) => (p.planType === planType ? { ...p, ...res.plan } : p))
          );
        }
      })
    );
  }

  // ── on-demand seed for accounts created before Razorpay integration ──
  initializePlans(): Observable<any> {
    this.isInitializing.set(true);
    return this.api.post<any>('super/access-plans/initialize', {}).pipe(
      tap((res) => {
        this.isInitializing.set(false);
        if (res.success) this.plans.set(res.plans);
      })
    );
  }
}