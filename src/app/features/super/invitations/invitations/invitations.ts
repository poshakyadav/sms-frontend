// features/super/invitations/invitations.ts

import { Component, OnInit, signal, computed } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './invitations.html',
  styleUrl: './invitations.scss',
})
export class Invitations implements OnInit {
  invitations = signal<Invitation[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Modal state
  showCreateModal = signal(false);
  creating = signal(false);
  createForm: FormGroup;

  // Action states
  cancellingId = signal<number | null>(null);
  resendingId = signal<number | null>(null);

  // Filter
  filterStatus = signal<string>('ALL');

  filteredInvitations = computed(() => {
    const all = this.invitations();
    const status = this.filterStatus();
    if (status === 'ALL') return all;
    return all.filter((i) => i.status === status);
  });

  readonly STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Pending', cls: 'badge--amber' },
    REGISTERED: { label: 'Registered', cls: 'badge--blue' },
    PAYMENT_SUBMITTED: { label: 'Payment Submitted', cls: 'badge--purple' },
    PAYMENT_APPROVED: { label: 'Active', cls: 'badge--green' },
    EXPIRED: { label: 'Expired', cls: 'badge--gray' },
    CANCELLED: { label: 'Cancelled', cls: 'badge--red' },
  };

  constructor(private fb: FormBuilder, private api: ApiService, private toast: ToastService) {
    this.createForm = this.fb.group({
      schoolName: ['', [Validators.required, Validators.minLength(2)]],
      schoolEmail: ['', [Validators.required, Validators.email]],
      schoolPhone: [''],
      city: [''],
      notes: [''],
      expiryDays: [30, [Validators.required, Validators.min(1), Validators.max(90)]],
    });
  }

  ngOnInit() {
    this.loadInvitations();
  }

  loadInvitations() {
    this.loading.set(true);
    this.api.get<{ success: boolean; invitations: Invitation[] }>('invitations').subscribe({
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

  openCreate() {
    this.createForm.reset({ expiryDays: 30 });
    this.showCreateModal.set(true);
  }

  closeCreate() {
    this.showCreateModal.set(false);
  }

  createInvitation() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    const raw = this.createForm.value;
    const payload: any = {
      schoolName: raw.schoolName.trim(),
      schoolEmail: raw.schoolEmail.trim().toLowerCase(),
      expiryDays: raw.expiryDays,
    };
    if (raw.schoolPhone?.trim()) payload.schoolPhone = raw.schoolPhone.trim();
    if (raw.city?.trim()) payload.city = raw.city.trim();
    if (raw.notes?.trim()) payload.notes = raw.notes.trim();

    this.api.post<any>('invitations', payload).subscribe({
      next: (res) => {
        this.creating.set(false);
        this.showCreateModal.set(false);
        this.toast.success(`Invitation sent to ${payload.schoolEmail}!`);
        this.loadInvitations();
      },
      error: (err) => {
        this.creating.set(false);
        this.toast.error(err?.error?.error || 'Failed to create invitation');
      },
    });
  }

  cancelInvitation(id: number, schoolName: string) {
    if (!confirm(`Cancel invitation for ${schoolName}?`)) return;
    this.cancellingId.set(id);
    this.api.post<any>(`invitations/${id}/cancel`, {}).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.toast.success('Invitation cancelled');
        this.loadInvitations();
      },
      error: (err) => {
        this.cancellingId.set(null);
        this.toast.error(err?.error?.error || 'Failed to cancel');
      },
    });
  }

  resendInvitation(id: number) {
    this.resendingId.set(id);
    this.api.post<any>(`invitations/${id}/resend`, {}).subscribe({
      next: () => {
        this.resendingId.set(null);
        this.toast.success('Invitation email resent!');
      },
      error: (err) => {
        this.resendingId.set(null);
        this.toast.error(err?.error?.error || 'Failed to resend');
      },
    });
  }

  setFilter(status: string) {
    this.filterStatus.set(status);
  }

  getStatusInfo(status: string) {
    return this.STATUS_LABELS[status] || { label: status, cls: 'badge--gray' };
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

  get pendingCount(): number {
    return this.invitations().filter((i) => i.status === 'PENDING').length;
  }

  get activeCount(): number {
    return this.invitations().filter((i) => i.status === 'PAYMENT_APPROVED').length;
  }
}
