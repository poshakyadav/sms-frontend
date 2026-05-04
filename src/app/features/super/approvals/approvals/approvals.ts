import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

interface Approval {
  id: number;
  schoolId: number;
  invitationId: number;
  amountExpected: number;
  amountPaid: number | null;
  utrNumber: string | null;
  screenshotUrl: string | null;
  payerName: string | null;
  payerPhone: string | null;
  submittedAt: string | null;
  status: string;
  rejectionReason: string | null;
  internalNotes: string | null;
  verifiedAt: string | null;
  createdAt: string;
  schoolName: string;
  schoolEmail: string;
  schoolPhone: string | null;
  onboardingStatus: string;
  invitationCity: string | null;
}

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approvals.html',
  styleUrl: './approvals.scss',
})
export class Approvals implements OnInit {
  approvals = signal<Approval[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Active detail panel
  selected = signal<Approval | null>(null);

  // Action states
  approvingId = signal<number | null>(null);
  rejectingId = signal<number | null>(null);

  // Reject modal
  showRejectModal = signal(false);
  rejectReason = '';
  rejectTargetId = signal<number | null>(null);

  // Notes modal
  approveNotes = '';
  showApproveConfirm = signal(false);
  approveTargetId = signal<number | null>(null);

  // Filter
  filterStatus = signal<string>('SUBMITTED');

  filteredApprovals = computed(() => {
    const all = this.approvals();
    const status = this.filterStatus();
    if (status === 'ALL') return all;
    return all.filter((a) => a.status === status);
  });

  readonly STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    SUBMITTED: { label: 'Pending Verification', cls: 'badge--amber' },
    VERIFIED: { label: 'Approved', cls: 'badge--green' },
    REJECTED: { label: 'Rejected', cls: 'badge--red' },
  };

  get pendingCount(): number {
    return this.approvals().filter((a) => a.status === 'SUBMITTED').length;
  }

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() {
    this.loadApprovals();
  }

  loadApprovals() {
    this.loading.set(true);
    this.api.get<{ success: boolean; approvals: Approval[] }>('approvals').subscribe({
      next: (res) => {
        this.approvals.set(res.approvals);
        // Re-select if still in list
        const sel = this.selected();
        if (sel) {
          const updated = res.approvals.find((a) => a.id === sel.id);
          this.selected.set(updated || null);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load approvals');
        this.loading.set(false);
      },
    });
  }

  selectApproval(approval: Approval) {
    this.selected.set(approval);
  }

  // ── Approve flow ──────────────────────────────────────────────────────────

  openApproveConfirm(id: number) {
    this.approveTargetId.set(id);
    this.approveNotes = '';
    this.showApproveConfirm.set(true);
  }

  closeApproveConfirm() {
    this.showApproveConfirm.set(false);
    this.approveTargetId.set(null);
  }

  confirmApprove() {
    const id = this.approveTargetId();
    if (!id) return;

    this.approvingId.set(id);
    this.showApproveConfirm.set(false);

    this.api.post<any>(`approvals/${id}/approve`, { internalNotes: this.approveNotes }).subscribe({
      next: () => {
        this.approvingId.set(null);
        this.toast.success('Payment approved! School is now active.');
        this.loadApprovals();
      },
      error: (err) => {
        this.approvingId.set(null);
        this.toast.error(err?.error?.error || 'Failed to approve payment');
      },
    });
  }

  // ── Reject flow ───────────────────────────────────────────────────────────

  openReject(id: number) {
    this.rejectTargetId.set(id);
    this.rejectReason = '';
    this.showRejectModal.set(true);
  }

  closeReject() {
    this.showRejectModal.set(false);
    this.rejectTargetId.set(null);
  }

  confirmReject() {
    const id = this.rejectTargetId();
    if (!id || !this.rejectReason.trim()) {
      this.toast.error('Please enter a rejection reason');
      return;
    }

    this.rejectingId.set(id);
    this.showRejectModal.set(false);

    this.api
      .post<any>(`approvals/${id}/reject`, { rejectionReason: this.rejectReason.trim() })
      .subscribe({
        next: () => {
          this.rejectingId.set(null);
          this.toast.success('Payment rejected. School has been notified.');
          this.loadApprovals();
        },
        error: (err) => {
          this.rejectingId.set(null);
          this.toast.error(err?.error?.error || 'Failed to reject payment');
        },
      });
  }

  setFilter(status: string) {
    this.filterStatus.set(status);
  }

  getStatusInfo(status: string) {
    return this.STATUS_LABELS[status] || { label: status, cls: 'badge--gray' };
  }

  formatCurrency(paise: number | null): string {
    if (!paise) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  }

  daysSince(dateStr: string | null): string {
    if (!dateStr) return '—';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
}
