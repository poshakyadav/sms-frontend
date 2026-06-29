// features/super/invitations/invitations.ts

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  afterNextRender,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

interface Invitation {
  id: number;
  inviteToken: string;
  schoolName: string;
  schoolEmail: string;
  schoolPhone?: string;
  city?: string;
  notes?: string;
  status: string;
  expiresAt: string;
  registeredAt?: string;
  schoolId?: number;
  invitedBy?: number;
  inviterName?: string;
  createdAt: string;
}

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe],
  templateUrl: './invitations.html',
  styleUrl: './invitations.scss',
})
export class Invitations {
  // ── DI via inject() ──────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  // ── State ────────────────────────────────────────────────────────────────
  readonly invitations = signal<Invitation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Modal
  readonly showCreateModal = signal(false);
  readonly creating = signal(false);

  // Row-level async states
  readonly cancellingId = signal<number | null>(null);
  readonly resendingId = signal<number | null>(null);

  // Filter
  readonly filterStatus = signal<string>('ALL');

  // Derived
  readonly filteredInvitations = computed(() => {
    const status = this.filterStatus();
    return status === 'ALL'
      ? this.invitations()
      : this.invitations().filter((i) => i.status === status);
  });

  readonly pendingCount = computed(
    () => this.invitations().filter((i) => i.status === 'PENDING').length
  );

  readonly activeCount = computed(
    () => this.invitations().filter((i) => i.status === 'PAYMENT_APPROVED').length
  );

  // Form
  readonly createForm: FormGroup = this.fb.group({
    schoolName: ['', [Validators.required, Validators.minLength(2)]],
    schoolEmail: ['', [Validators.required, Validators.email]],
    schoolPhone: [''],
    city: [''],
    notes: [''],
    expiryDays: [30, [Validators.required, Validators.min(1), Validators.max(90)]],
  });

  // Status metadata
  readonly STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Pending', cls: 'badge--amber' },
    REGISTERED: { label: 'Registered', cls: 'badge--blue' },
    PAYMENT_SUBMITTED: { label: 'Payment Submitted', cls: 'badge--purple' },
    PAYMENT_APPROVED: { label: 'Active', cls: 'badge--green' },
    EXPIRED: { label: 'Expired', cls: 'badge--gray' },
    CANCELLED: { label: 'Cancelled', cls: 'badge--red' },
  };

  readonly FILTER_TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'REGISTERED', label: 'Registered' },
    { key: 'PAYMENT_SUBMITTED', label: 'Payment Submitted' },
    { key: 'PAYMENT_APPROVED', label: 'Active' },
    { key: 'EXPIRED', label: 'Expired' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  constructor() {
    // Defer the initial HTTP call until after first render
    afterNextRender(() => this.loadInvitations());
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  loadInvitations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<{ success: boolean; invitations: Invitation[] }>('invitations')
      .subscribe({
        next: (res) => {
          this.invitations.set(res.invitations);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load invitations');
          this.loading.set(false);
        },
      });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  openCreate(): void {
    this.createForm.reset({ expiryDays: 30 });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    this.showCreateModal.set(false);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  createInvitation(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    const raw = this.createForm.value;

    const payload: Record<string, unknown> = {
      schoolName: (raw.schoolName as string).trim(),
      schoolEmail: (raw.schoolEmail as string).trim().toLowerCase(),
      expiryDays: raw.expiryDays,
    };
    if ((raw.schoolPhone as string)?.trim()) payload['schoolPhone'] = (raw.schoolPhone as string).trim();
    if ((raw.city as string)?.trim()) payload['city'] = (raw.city as string).trim();
    if ((raw.notes as string)?.trim()) payload['notes'] = (raw.notes as string).trim();

    this.api.post<{ success: boolean }>('invitations', payload).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreateModal.set(false);
        this.toast.success(`Invitation sent to ${payload['schoolEmail']}!`);
        this.loadInvitations();
      },
      error: (err: { error?: { error?: string } }) => {
        this.creating.set(false);
        this.toast.error(err?.error?.error ?? 'Failed to create invitation');
      },
    });
  }

  cancelInvitation(id: number, schoolName: string): void {
    if (!confirm(`Cancel invitation for ${schoolName}?`)) return;

    this.cancellingId.set(id);
    this.api.post<{ success: boolean }>(`invitations/${id}/cancel`, {}).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.toast.success('Invitation cancelled');
        this.loadInvitations();
      },
      error: (err: { error?: { error?: string } }) => {
        this.cancellingId.set(null);
        this.toast.error(err?.error?.error ?? 'Failed to cancel');
      },
    });
  }

  resendInvitation(id: number): void {
    this.resendingId.set(id);
    this.api.post<{ success: boolean }>(`invitations/${id}/resend`, {}).subscribe({
      next: () => {
        this.resendingId.set(null);
        this.toast.success('Invitation email resent!');
      },
      error: (err: { error?: { error?: string } }) => {
        this.resendingId.set(null);
        this.toast.error(err?.error?.error ?? 'Failed to resend');
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  setFilter(status: string): void {
    this.filterStatus.set(status);
  }

  getStatusInfo(status: string): { label: string; cls: string } {
    return this.STATUS_LABELS[status] ?? { label: status, cls: 'badge--gray' };
  }

  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  canCancel(status: string): boolean {
    return !['PAYMENT_APPROVED', 'CANCELLED', 'EXPIRED'].includes(status);
  }

  canResend(status: string): boolean {
    return !['CANCELLED', 'PAYMENT_APPROVED'].includes(status);
  }
}