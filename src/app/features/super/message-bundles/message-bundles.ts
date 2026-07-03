// src/app/features/super/message-bundles/message-bundles.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MessageBundlesService,
  MessageBundle,
  MessageChannel,
} from '../../../core/services/message-bundles.service';

type ChannelTab = MessageChannel;

interface SeedTemplate {
  name: string;
  messageCount: number;
  amountPaise: number;
  discountPaise: number;
  validityDays: number;
  sortOrder: number;
}

// Sensible WhatsApp starter tiers (UTILITY messages cost us ~₹0.16 each —
// these give healthy margin while staying attractive). Edit freely after
// quick-setup; this is just a one-click bootstrap, not a fixed price list.
const QUICK_SEED_DEFAULTS: Record<ChannelTab, SeedTemplate[]> = {
  WHATSAPP: [
    { name: 'Starter Pack', messageCount: 100, amountPaise: 5000, discountPaise: 0, validityDays: 365, sortOrder: 1 },
    { name: 'Growth Pack', messageCount: 500, amountPaise: 22500, discountPaise: 2500, validityDays: 365, sortOrder: 2 },
    { name: 'Scale Pack', messageCount: 1000, amountPaise: 40000, discountPaise: 8000, validityDays: 365, sortOrder: 3 },
    { name: 'Bulk Pack', messageCount: 5000, amountPaise: 175000, discountPaise: 60000, validityDays: 365, sortOrder: 4 },
  ],
  EMAIL: [],
  SMS: [],
};

function discountNotExceedingAmountValidator(group: AbstractControl): ValidationErrors | null {
  const amount = Number(group.get('amountRupees')?.value ?? 0);
  const discount = Number(group.get('discountRupees')?.value ?? 0);
  return discount > amount ? { discountExceedsAmount: true } : null;
}

@Component({
  selector: 'app-message-bundles-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-page">
      <div class="mb-header">
        <h1 class="mb-title">Message Bundles</h1>
        <p class="mb-subtitle">
          Manage the prepaid credit packs schools can purchase for WhatsApp, Email, and SMS
          notifications.
        </p>
      </div>

      <div class="mb-toolbar">
        <div class="mb-tabs">
          @for (ch of channels; track ch.key) {
          <button
            type="button"
            class="mb-tab"
            [class.mb-tab--active]="activeChannel() === ch.key"
            [disabled]="!ch.enabled"
            [title]="!ch.enabled ? 'Coming soon' : ''"
            (click)="selectChannel(ch.key)"
          >
            {{ ch.label }}
            @if (!ch.enabled) {
            <span class="mb-tab__soon">Soon</span>
            }
          </button>
          }
        </div>

        @if (canManage()) {
        <button type="button" class="mb-btn mb-btn--primary" (click)="openCreate()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Bundle
        </button>
        }
      </div>

      @if (!canManage()) {
      <div class="mb-permission-note">
        You have view-only access. A super admin with the "message-bundles.manage" permission
        can make changes here.
      </div>
      }

      @if (isLoading()) {
      <div class="mb-skeleton-list">
        <div class="mb-skeleton-row"></div>
        <div class="mb-skeleton-row"></div>
        <div class="mb-skeleton-row"></div>
      </div>
      } @else {
      @if (errorMsg()) {
      <div class="mb-error-banner">{{ errorMsg() }}</div>
      }

      @if (bundles().length === 0) {
      <div class="mb-empty">
        <p>No {{ activeChannelLabel() }} bundles configured yet.</p>
        @if (canManage() && activeChannel() === 'WHATSAPP') {
        <button
          type="button"
          class="mb-btn mb-btn--ghost"
          [disabled]="isSeeding()"
          (click)="quickSeed()"
        >
          @if (isSeeding()) {
          <span class="mb-spinner"></span>
          Setting up…
          } @else { Quick-setup 4 starter bundles }
        </button>
        }
      </div>
      } @else {
      <div class="mb-table-wrap">
        <table class="mb-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Messages</th>
              <th>Price</th>
              <th>Per Message</th>
              <th>Validity</th>
              <th>Sort</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of bundles(); track b.id) {
            <tr [class.mb-row--inactive]="!b.isActive">
              <td class="mb-cell-name">{{ b.name }}</td>
              <td>{{ b.messageCount | number }}</td>
              <td>
                @if (b.discountPaise > 0) {
                <span class="mb-strike">₹{{ formatPaise(b.amountPaise) }}</span>
                }
                <span class="mb-final">₹{{ formatPaise(b.finalAmountPaise) }}</span>
              </td>
              <td>₹{{ perMessageCost(b).toFixed(2) }}</td>
              <td>{{ b.validityDays }} days</td>
              <td>{{ b.sortOrder }}</td>
              <td>
                <span
                  class="mb-badge"
                  [class.mb-badge--active]="b.isActive"
                  [class.mb-badge--inactive]="!b.isActive"
                >
                  {{ b.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="mb-actions">
                @if (canManage()) {
                <button class="mb-icon-btn" title="Edit" (click)="openEdit(b)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button
                  class="mb-icon-btn"
                  [class.mb-icon-btn--danger]="b.isActive"
                  [disabled]="savingId() === b.id"
                  [title]="b.isActive ? 'Deactivate' : 'Reactivate'"
                  (click)="toggleActive(b)"
                >
                  @if (savingId() === b.id) {
                  <span class="mb-spinner mb-spinner--sm"></span>
                  } @else {
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  }
                </button>
                }
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      } }

      @if (isFormOpen()) {
      <div class="mb-backdrop" (click)="closeForm()"></div>
      <div class="mb-drawer">
        <div class="mb-drawer__header">
          <h2>{{ editingBundle() ? 'Edit Bundle' : 'New Bundle' }}</h2>
          <button type="button" class="mb-close-btn" (click)="closeForm()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mb-form">
          <div class="mb-field">
            <label>Channel</label>
            <input type="text" [value]="activeChannel()" disabled class="mb-input mb-input--disabled" />
          </div>

          <div class="mb-field">
            <label for="name">Bundle Name</label>
            <input id="name" type="text" formControlName="name" class="mb-input" placeholder="e.g. Growth Pack" />
            @if (form.get('name')?.touched && form.get('name')?.invalid) {
            <span class="mb-field-error">Name must be 2–100 characters.</span>
            }
          </div>

          <div class="mb-field-row">
            <div class="mb-field">
              <label for="messageCount">Message Count</label>
              <input id="messageCount" type="number" formControlName="messageCount" class="mb-input" min="1" />
            </div>
            <div class="mb-field">
              <label for="validityDays">Validity (days)</label>
              <input id="validityDays" type="number" formControlName="validityDays" class="mb-input" min="1" />
            </div>
          </div>

          <div class="mb-field-row">
            <div class="mb-field">
              <label for="amountRupees">Price (₹)</label>
              <input id="amountRupees" type="number" step="0.01" formControlName="amountRupees" class="mb-input" min="0" />
            </div>
            <div class="mb-field">
              <label for="discountRupees">Discount (₹)</label>
              <input id="discountRupees" type="number" step="0.01" formControlName="discountRupees" class="mb-input" min="0" />
            </div>
          </div>
          @if (form.errors?.['discountExceedsAmount']) {
          <span class="mb-field-error">Discount cannot exceed the price.</span>
          }

          <div class="mb-field">
            <label for="sortOrder">Sort Order</label>
            <input id="sortOrder" type="number" formControlName="sortOrder" class="mb-input" min="0" />
          </div>

          <div class="mb-preview">
            <div class="mb-preview__row">
              <span>Final Price</span>
              <strong>₹{{ previewFinal().toFixed(2) }}</strong>
            </div>
            <div class="mb-preview__row">
              <span>Per Message</span>
              <strong>₹{{ previewPerMessage().toFixed(3) }}</strong>
            </div>
          </div>

          <div class="mb-drawer__footer">
            <button type="button" class="mb-btn mb-btn--ghost" (click)="closeForm()">Cancel</button>
            <button type="submit" class="mb-btn mb-btn--primary" [disabled]="form.invalid || isSubmitting()">
              @if (isSubmitting()) {
              <span class="mb-spinner"></span>
              Saving…
              } @else { {{ editingBundle() ? 'Save Changes' : 'Create Bundle' }} }
            </button>
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [`
    .mb-page { max-width: 1080px; margin: 0 auto; padding: 24px 20px 64px; display: flex; flex-direction: column; gap: 20px; }
    .mb-header { display: flex; flex-direction: column; gap: 4px; }
    .mb-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary, #111827); margin: 0; }
    .mb-subtitle { font-size: 0.9rem; color: var(--color-text-secondary, #6b7280); margin: 0; }

    .mb-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .mb-tabs { display: flex; gap: 6px; background: var(--color-bg-subtle, #f3f4f6); padding: 4px; border-radius: 10px; }
    .mb-tab { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border: none; background: transparent; border-radius: 7px; font-size: 0.85rem; font-weight: 600; color: var(--color-text-secondary, #6b7280); cursor: pointer; }
    .mb-tab:disabled { cursor: not-allowed; opacity: 0.55; }
    .mb-tab--active { background: #fff; color: #4f46e5; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .mb-tab__soon { font-size: 0.62rem; font-weight: 700; padding: 1px 5px; border-radius: 99px; background: #e5e7eb; color: #6b7280; }

    .mb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s; }
    .mb-btn--primary { background: #4f46e5; color: #fff; }
    .mb-btn--primary:hover:not(:disabled) { background: #4338ca; }
    .mb-btn--ghost { background: var(--color-bg-subtle, #f3f4f6); color: var(--color-text-primary, #111827); }
    .mb-btn--ghost:hover:not(:disabled) { background: #e5e7eb; }
    .mb-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .mb-permission-note { padding: 10px 14px; border-radius: 8px; background: #fff7ed; color: #9a3412; font-size: 0.8rem; border: 1px solid #fed7aa; }
    .mb-error-banner { padding: 10px 14px; border-radius: 8px; background: #fef2f2; color: #b91c1c; font-size: 0.85rem; border: 1px solid #fecaca; }

    .mb-skeleton-list { display: flex; flex-direction: column; gap: 10px; }
    .mb-skeleton-row { height: 52px; border-radius: 10px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%); background-size: 200% 100%; animation: mb-shimmer 1.4s infinite; }
    @keyframes mb-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .mb-empty { padding: 40px; text-align: center; border-radius: 12px; background: var(--color-bg-subtle, #f9fafb); color: var(--color-text-secondary, #6b7280); font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 14px; }

    .mb-table-wrap { overflow-x: auto; border: 1px solid var(--color-border, #e5e7eb); border-radius: 12px; }
    .mb-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .mb-table thead tr { background: var(--color-bg-subtle, #f9fafb); }
    .mb-table th { text-align: left; padding: 12px 14px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-secondary, #6b7280); font-weight: 700; border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .mb-table td { padding: 12px 14px; border-bottom: 1px solid var(--color-border, #f1f2f4); color: var(--color-text-primary, #111827); vertical-align: middle; }
    .mb-table tr:last-child td { border-bottom: none; }
    .mb-row--inactive { opacity: 0.55; }
    .mb-cell-name { font-weight: 600; }
    .mb-strike { display: block; font-size: 0.72rem; color: #9ca3af; text-decoration: line-through; }
    .mb-final { font-weight: 700; }

    .mb-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 700; }
    .mb-badge--active { background: #d1fae5; color: #065f46; }
    .mb-badge--inactive { background: #f3f4f6; color: #6b7280; }

    .mb-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .mb-icon-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 7px; border: 1px solid var(--color-border, #e5e7eb); background: #fff; color: var(--color-text-secondary, #6b7280); cursor: pointer; }
    .mb-icon-btn:hover:not(:disabled) { background: var(--color-bg-subtle, #f3f4f6); }
    .mb-icon-btn--danger:hover:not(:disabled) { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
    .mb-icon-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .mb-spinner { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(0,0,0,0.15); border-top-color: currentColor; animation: mb-spin 0.7s linear infinite; }
    .mb-spinner--sm { width: 12px; height: 12px; }
    @keyframes mb-spin { to { transform: rotate(360deg); } }

    .mb-backdrop { position: fixed; inset: 0; background: rgba(17, 24, 39, 0.45); z-index: 40; }
    .mb-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; max-width: 92vw; background: #fff; z-index: 41; display: flex; flex-direction: column; box-shadow: -8px 0 24px rgba(0,0,0,0.15); }
    .mb-drawer__header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .mb-drawer__header h2 { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--color-text-primary, #111827); }
    .mb-close-btn { border: none; background: transparent; color: var(--color-text-secondary, #6b7280); cursor: pointer; padding: 4px; border-radius: 6px; }
    .mb-close-btn:hover { background: var(--color-bg-subtle, #f3f4f6); }

    .mb-form { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
    .mb-field { display: flex; flex-direction: column; gap: 5px; }
    .mb-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .mb-field label { font-size: 0.78rem; font-weight: 600; color: var(--color-text-secondary, #6b7280); }
    .mb-input { padding: 9px 11px; border-radius: 8px; border: 1px solid var(--color-border, #d1d5db); font-size: 0.88rem; color: var(--color-text-primary, #111827); }
    .mb-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
    .mb-input--disabled { background: var(--color-bg-subtle, #f3f4f6); color: var(--color-text-secondary, #9ca3af); }
    .mb-field-error { font-size: 0.72rem; color: #dc2626; }

    .mb-preview { background: var(--color-bg-subtle, #f9fafb); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
    .mb-preview__row { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--color-text-secondary, #6b7280); }
    .mb-preview__row strong { color: var(--color-text-primary, #111827); }

    .mb-drawer__footer { display: flex; gap: 10px; padding-top: 6px; }
    .mb-drawer__footer .mb-btn { flex: 1; justify-content: center; }
  `],
})
export class MessageBundlesManagement implements OnInit {
  private bundlesApi = inject(MessageBundlesService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  canManage = computed(() => this.auth.hasSuperPermission('message-bundles.manage'));

  activeChannel = signal<ChannelTab>('WHATSAPP');
  bundles = signal<MessageBundle[]>([]);
  isLoading = signal(true);
  isSeeding = signal(false);
  isSubmitting = signal(false);
  errorMsg = signal<string | null>(null);

  isFormOpen = signal(false);
  editingBundle = signal<MessageBundle | null>(null);
  savingId = signal<number | null>(null);

  readonly channels: { key: ChannelTab; label: string; enabled: boolean }[] = [
    { key: 'WHATSAPP', label: 'WhatsApp', enabled: true },
    { key: 'EMAIL', label: 'Email', enabled: false },
    { key: 'SMS', label: 'SMS', enabled: false },
  ];

  activeChannelLabel = computed(
    () => this.channels.find((c) => c.key === this.activeChannel())?.label ?? ''
  );

  form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      messageCount: [100, [Validators.required, Validators.min(1)]],
      amountRupees: [0, [Validators.required, Validators.min(0.01)]],
      discountRupees: [0, [Validators.min(0)]],
      validityDays: [365, [Validators.required, Validators.min(1)]],
      sortOrder: [0, [Validators.min(0)]],
    },
    { validators: [discountNotExceedingAmountValidator] }
  );

  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  previewFinal = computed(() => {
    const v = this.formValue();
    const amount = Number(v.amountRupees) || 0;
    const discount = Number(v.discountRupees) || 0;
    return Math.max(amount - discount, 0);
  });

  previewPerMessage = computed(() => {
    const count = Number(this.formValue().messageCount) || 0;
    return count > 0 ? this.previewFinal() / count : 0;
  });

  ngOnInit(): void {
    this.loadBundles();
  }

  selectChannel(channel: ChannelTab): void {
    const ch = this.channels.find((c) => c.key === channel);
    if (!ch?.enabled || this.activeChannel() === channel) return;
    this.activeChannel.set(channel);
    this.loadBundles();
  }

  loadBundles(): void {
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.bundlesApi.list(this.activeChannel()).subscribe({
      next: (res) => {
        if (res.success) {
          this.bundles.set([...res.bundles].sort((a, b) => a.sortOrder - b.sortOrder));
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Failed to load bundles.');
        this.isLoading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingBundle.set(null);
    const nextSort = this.bundles().length
      ? Math.max(...this.bundles().map((b) => b.sortOrder)) + 1
      : 1;
    this.form.reset({
      name: '',
      messageCount: 100,
      amountRupees: 0,
      discountRupees: 0,
      validityDays: 365,
      sortOrder: nextSort,
    });
    this.isFormOpen.set(true);
  }

  openEdit(bundle: MessageBundle): void {
    this.editingBundle.set(bundle);
    this.form.reset({
      name: bundle.name,
      messageCount: bundle.messageCount,
      amountRupees: bundle.amountPaise / 100,
      discountRupees: bundle.discountPaise / 100,
      validityDays: bundle.validityDays,
      sortOrder: bundle.sortOrder,
    });
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingBundle.set(null);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const amountPaise = Math.round(Number(raw.amountRupees) * 100);
    const discountPaise = Math.round(Number(raw.discountRupees) * 100);
    const editing = this.editingBundle();

    this.isSubmitting.set(true);

    const req = editing
      ? this.bundlesApi.update(editing.id, {
        name: raw.name,
        messageCount: raw.messageCount,
        amountPaise,
        discountPaise,
        validityDays: raw.validityDays,
        sortOrder: raw.sortOrder,
      })
      : this.bundlesApi.create({
        channel: this.activeChannel(),
        name: raw.name,
        messageCount: raw.messageCount,
        amountPaise,
        discountPaise,
        validityDays: raw.validityDays,
        sortOrder: raw.sortOrder,
      });

    req.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success) {
          this.toast.success(editing ? 'Bundle updated successfully.' : 'Bundle created successfully.');
          this.closeForm();
          this.loadBundles();
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toast.error(err?.error?.error || 'Failed to save bundle.');
      },
    });
  }

  toggleActive(bundle: MessageBundle): void {
    if (this.savingId() !== null) return;
    this.savingId.set(bundle.id);
    this.bundlesApi.update(bundle.id, { isActive: !bundle.isActive }).subscribe({
      next: (res) => {
        this.savingId.set(null);
        if (res.success) {
          this.toast.success(bundle.isActive ? 'Bundle deactivated.' : 'Bundle reactivated.');
          this.bundles.update((list) =>
            list.map((b) => (b.id === bundle.id ? { ...b, isActive: !b.isActive } : b))
          );
        }
      },
      error: (err) => {
        this.savingId.set(null);
        this.toast.error(err?.error?.error || 'Failed to update bundle status.');
      },
    });
  }

  quickSeed(): void {
    const defaults = QUICK_SEED_DEFAULTS[this.activeChannel()];
    if (!defaults.length || this.isSeeding()) return;

    this.isSeeding.set(true);
    const requests = defaults.map((d) =>
      this.bundlesApi.create({ channel: this.activeChannel(), ...d })
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.isSeeding.set(false);
        this.toast.success('Starter bundles created. Edit pricing anytime.');
        this.loadBundles();
      },
      error: (err) => {
        this.isSeeding.set(false);
        this.toast.error(err?.error?.error || 'Quick setup failed. Add bundles manually instead.');
        this.loadBundles();
      },
    });
  }

  formatPaise(paise: number): string {
    return (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  perMessageCost(bundle: MessageBundle): number {
    if (bundle.messageCount <= 0) return 0;
    return bundle.finalAmountPaise / bundle.messageCount / 100;
  }
}