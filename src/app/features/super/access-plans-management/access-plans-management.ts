// src/app/features/super/access-plans/access-plans-management/access-plans-management.ts

import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { SuperAccessPlan, SuperAccessPlansService, UpdateAccessPlanInput } from '../../../core/services/super-access-plans.service';

interface EditState {
  name: string;
  amountRupees: number;
  discountRupees: number;
  autopayEnabled: boolean;
  isActive: boolean;
}

@Component({
  selector: 'app-access-plans-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aplans-page">
      <div class="aplans-header">
        <h1>Access Plans</h1>
        <p>Configure the MONTHLY and YEARLY pricing schools see on their Billing page.</p>
      </div>

      @if (isLoading()) {
      <div class="aplans-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
      }

      <!-- ═══════════ EMPTY STATE — no plans seeded yet ═══════════ -->
      @if (!isLoading() && plans().length === 0) {
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <h2 class="empty-state__title">No access plans configured yet</h2>
        <p class="empty-state__desc">
          This super admin account was created before pricing was set up, so the MONTHLY and YEARLY
          plans were never initialized. Set them up now with sensible defaults — you can edit the
          pricing right after.
        </p>

        @if (canManage()) {
        <button class="aplan-btn aplan-btn--primary" [disabled]="isInitializing()" (click)="initializePlans()">
          @if (isInitializing()) {
          <span class="btn-spinner"></span> Initializing…
          } @else {
          Initialize Access Plans
          }
        </button>
        } @else {
        <p class="aplan-readonly-note">Contact a super admin with billing-configuration access to set this up.</p>
        }
      </div>
      }

      <!-- ═══════════ NORMAL GRID — plans exist ═══════════ -->
      @if (!isLoading() && plans().length > 0) {
      <div class="aplans-grid">
        @for (plan of plans(); track plan.id) {
        <div class="aplan-card" [class.aplan-card--inactive]="!plan.isActive">
          <div class="aplan-card__top">
            <span class="aplan-card__type">{{ plan.planType }}</span>
            <div class="aplan-card__badges">
              @if (!plan.isActive) { <span class="badge badge--muted">Inactive</span> }
              @if (plan.activeAutopaySubscriptions > 0) {
              <span class="badge badge--info">{{ plan.activeAutopaySubscriptions }} on autopay</span>
              }
            </div>
          </div>

          @if (editingPlanType() !== plan.planType) {
          <!-- VIEW MODE -->
          <h2 class="aplan-card__name">{{ plan.name }}</h2>
          <div class="aplan-card__price">
            @if (plan.discountPaise > 0) {
            <span class="aplan-card__original">₹{{ plan.amountPaise / 100 | number : '1.0-2' }}</span>
            <span class="badge badge--save">{{ savingsPercent(plan) }}% off</span>
            }
            <span class="aplan-card__final">₹{{ plan.finalAmountPaise / 100 | number : '1.0-2' }}</span>
            <span class="aplan-card__period">/ {{ plan.planType === 'MONTHLY' ? 'month' : 'year' }}</span>
          </div>

          <dl class="aplan-card__meta">
            <div><dt>Duration</dt><dd>{{ plan.durationDays }} days</dd></div>
            <div><dt>UPI Autopay</dt><dd>{{ plan.autopayEnabled ? 'Enabled' : 'Disabled' }}</dd></div>
            <div><dt>Razorpay Plan</dt><dd>{{ plan.razorpayPlanId || '— created on next signup —' }}</dd></div>
            <div><dt>Last updated</dt><dd>{{ plan.updatedAt | date : 'medium' }}</dd></div>
          </dl>

          @if (canManage()) {
          <button class="aplan-btn aplan-btn--primary" (click)="startEdit(plan)">Edit plan</button>
          } @else {
          <p class="aplan-readonly-note">You have view-only access to billing configuration.</p>
          }
          } @else {
          <!-- EDIT MODE -->
          @if (editState(); as state) {
          <div class="aplan-form">
            <label class="aplan-field">
              <span>Display name</span>
              <input type="text" [ngModel]="state.name" (ngModelChange)="updateEditField('name', $event)" maxlength="100" />
            </label>

            <div class="aplan-field-row">
              <label class="aplan-field">
                <span>Sticker amount (₹)</span>
                <input type="number" min="1" step="1" [ngModel]="state.amountRupees" (ngModelChange)="updateEditField('amountRupees', $event)" />
              </label>
              <label class="aplan-field">
                <span>Discount (₹)</span>
                <input type="number" min="0" step="1" [ngModel]="state.discountRupees" (ngModelChange)="updateEditField('discountRupees', $event)" />
              </label>
            </div>

            <div class="aplan-preview">
              Payable price preview: <strong>₹{{ previewFinalPaise() / 100 | number : '1.0-2' }}</strong>
            </div>

            <label class="aplan-toggle-row">
              <input type="checkbox" [ngModel]="state.autopayEnabled" (ngModelChange)="updateEditField('autopayEnabled', $event)" />
              <span>Allow UPI Autopay for this plan</span>
            </label>
            <label class="aplan-toggle-row">
              <input type="checkbox" [ngModel]="state.isActive" (ngModelChange)="updateEditField('isActive', $event)" />
              <span>Plan is active (visible to schools)</span>
            </label>

            @if (plan.activeAutopaySubscriptions > 0) {
            <p class="aplan-warning">
              {{ plan.activeAutopaySubscriptions }} school(s) are on an active auto-renew subscription for this
              plan. Price changes here only apply to new sign-ups — their existing mandate keeps charging the old
              price until they cancel and re-subscribe.
            </p>
            }

            <div class="aplan-form-actions">
              <button class="aplan-btn aplan-btn--secondary" [disabled]="isSaving()" (click)="cancelEdit()">Cancel</button>
              <button class="aplan-btn aplan-btn--primary" [disabled]="isSaving()" (click)="save(plan)">
                @if (isSaving()) { <span class="btn-spinner"></span> Saving… } @else { Save changes }
              </button>
            </div>
          </div>
          }
          }
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .aplans-page { max-width: 900px; margin: 0 auto; padding: 24px 20px 64px; display: flex; flex-direction: column; gap: 24px; }
      .aplans-header h1 { margin: 0 0 4px; font-size: 1.5rem; font-weight: 700; color: #111827; }
      .aplans-header p { margin: 0; font-size: 0.9rem; color: #6b7280; }
      .aplans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      @media (max-width: 720px) { .aplans-grid { grid-template-columns: 1fr; } }
      .skeleton-card { height: 320px; border-radius: 14px; background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
      @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

      /* ── Empty state ── */
      .empty-state {
        display: flex; flex-direction: column; align-items: center; text-align: center;
        gap: 12px; padding: 56px 32px; border: 2px dashed #e5e7eb; border-radius: 14px;
        background: #fafafa;
      }
      .empty-state__icon {
        width: 64px; height: 64px; border-radius: 50%; background: #eef2ff; color: #4f46e5;
        display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
      }
      .empty-state__title { font-size: 1.05rem; font-weight: 700; color: #111827; margin: 0; }
      .empty-state__desc { font-size: 0.85rem; color: #6b7280; max-width: 440px; line-height: 1.6; margin: 0 0 8px; }

      .aplan-card { background: #fff; border: 2px solid #e5e7eb; border-radius: 14px; padding: 22px; display: flex; flex-direction: column; gap: 14px; }
      .aplan-card--inactive { opacity: 0.75; border-style: dashed; }
      .aplan-card__top { display: flex; justify-content: space-between; align-items: center; }
      .aplan-card__type { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; color: #6366f1; }
      .aplan-card__badges { display: flex; gap: 6px; }
      .badge { font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
      .badge--muted { background: #f3f4f6; color: #6b7280; }
      .badge--info { background: #eff6ff; color: #1e40af; }
      .badge--save { background: #ecfdf5; color: #065f46; }

      .aplan-card__name { margin: 0; font-size: 1.15rem; font-weight: 700; color: #111827; }
      .aplan-card__price { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .aplan-card__original { font-size: 0.85rem; color: #9ca3af; text-decoration: line-through; }
      .aplan-card__final { font-size: 1.6rem; font-weight: 800; color: #111827; }
      .aplan-card__period { font-size: 0.8rem; color: #6b7280; }

      .aplan-card__meta { margin: 0; display: flex; flex-direction: column; gap: 6px; }
      .aplan-card__meta div { display: flex; justify-content: space-between; font-size: 0.82rem; }
      .aplan-card__meta dt { color: #6b7280; margin: 0; font-weight: 500; }
      .aplan-card__meta dd { color: #111827; margin: 0; font-weight: 600; }

      .aplan-readonly-note { font-size: 0.78rem; color: #9ca3af; font-style: italic; margin: 0; }

      .aplan-btn { padding: 10px 16px; border-radius: 8px; font-size: 0.88rem; font-weight: 600; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
      .aplan-btn--primary { background: #4f46e5; color: #fff; }
      .aplan-btn--primary:hover:not(:disabled) { background: #4338ca; }
      .aplan-btn--secondary { background: #f3f4f6; color: #111827; }
      .aplan-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .aplan-form { display: flex; flex-direction: column; gap: 12px; }
      .aplan-field { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #374151; font-weight: 600; flex: 1; }
      .aplan-field input[type='text'], .aplan-field input[type='number'] { padding: 9px 10px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 0.88rem; font-weight: 500; color: #111827; }
      .aplan-field-row { display: flex; gap: 10px; }
      .aplan-preview { font-size: 0.85rem; color: #4f46e5; background: #eef2ff; padding: 8px 10px; border-radius: 8px; }
      .aplan-toggle-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #374151; }
      .aplan-warning { font-size: 0.78rem; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px; border-radius: 8px; line-height: 1.5; margin: 0; }
      .aplan-form-actions { display: flex; gap: 10px; }
      .aplan-form-actions .aplan-btn { flex: 1; }

      .btn-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: currentColor; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `,
  ],
})
export class AccessPlansManagement implements OnInit {
  private service = inject(SuperAccessPlansService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  canManage = computed(() => this.auth.hasSuperPermission('access-plans.manage'));

  plans = this.service.plans;
  isLoading = this.service.isLoading;
  isInitializing = this.service.isInitializing;

  editingPlanType = signal<'MONTHLY' | 'YEARLY' | null>(null);
  isSaving = signal(false);
  editState = signal<EditState | null>(null);

  previewFinalPaise = computed(() => {
    const state = this.editState();
    if (!state) return 0;
    return Math.max(0, Math.round(state.amountRupees * 100) - Math.round(state.discountRupees * 100));
  });

  ngOnInit(): void {
    this.service.loadPlans().subscribe({
      error: () => this.toast.error('Failed to load access plans.'),
    });
  }

  // ── NEW ──────────────────────────────────────────────────────────────────
  initializePlans(): void {
    if (!this.canManage()) return;
    this.service.initializePlans().subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Access plans initialized. You can now edit the pricing.');
        } else {
          this.toast.error(res.error || 'Failed to initialize access plans.');
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Failed to initialize access plans.');
      },
    });
  }

  startEdit(plan: SuperAccessPlan): void {
    if (!this.canManage()) return;
    this.editingPlanType.set(plan.planType);
    this.editState.set({
      name: plan.name,
      amountRupees: plan.amountPaise / 100,
      discountRupees: plan.discountPaise / 100,
      autopayEnabled: plan.autopayEnabled,
      isActive: plan.isActive,
    });
  }

  cancelEdit(): void {
    this.editingPlanType.set(null);
    this.editState.set(null);
  }

  updateEditField<K extends keyof EditState>(key: K, value: EditState[K]): void {
    const state = this.editState();
    if (!state) return;
    this.editState.set({ ...state, [key]: value });
  }

  save(plan: SuperAccessPlan): void {
    const state = this.editState();
    if (!state) return;

    const amountPaise = Math.round(state.amountRupees * 100);
    const discountPaise = Math.round(state.discountRupees * 100);

    if (amountPaise <= 0) {
      this.toast.error('Amount must be greater than zero.');
      return;
    }
    if (discountPaise < 0 || discountPaise > amountPaise) {
      this.toast.error('Discount cannot exceed the sticker amount.');
      return;
    }

    const input: UpdateAccessPlanInput = {
      name: state.name.trim(),
      amountPaise,
      discountPaise,
      autopayEnabled: state.autopayEnabled,
      isActive: state.isActive,
    };
    const priceChanging = amountPaise !== plan.amountPaise || discountPaise !== plan.discountPaise;

    this.isSaving.set(true);
    this.service.updatePlan(plan.planType, input).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        if (res.success) {
          this.toast.success(
            priceChanging && plan.activeAutopaySubscriptions > 0
              ? `Plan updated. ${plan.activeAutopaySubscriptions} existing auto-renew subscription(s) keep their old price.`
              : 'Plan updated successfully.'
          );
          this.cancelEdit();
        } else {
          this.toast.error(res.error || 'Failed to update plan.');
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toast.error(err?.error?.error || 'Failed to update plan.');
      },
    });
  }

  savingsPercent(plan: SuperAccessPlan): number {
    if (plan.amountPaise <= 0) return 0;
    return Math.round((plan.discountPaise / plan.amountPaise) * 100);
  }
}