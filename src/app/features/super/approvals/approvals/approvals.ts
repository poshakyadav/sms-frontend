// features/super/approvals/approvals/approvals.ts
//
// REWRITTEN: Razorpay-first approval queue replaces the old UTR-based UI.
// Two tabs:
//   • Razorpay (primary) — schools that paid via Razorpay Checkout and need activation
//   • UTR Legacy         — old manual bank-transfer records (read-only, for history)
//
// The activate action calls POST /approvals/razorpay/:schoolId/activate which
// provisions the Turso DB, seeds roles/permissions, and sends the activation email.

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

// ─── Razorpay queue types ──────────────────────────────────────────────────────

interface RazorpayQueueItem {
  schoolId: number;
  schoolName: string;
  schoolCode: string;
  schoolEmail: string;
  schoolPhone: string | null;
  onboardingStatus: string;
  invitationCity: string | null;
  platformPaymentId: number;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amountPaise: number;
  currency: string;
  method: string | null;
  capturedAt: string | null;
  paymentCreatedAt: string;
  activationStatus: 'PENDING' | 'ACTIVATED';
}

// ─── Legacy UTR types (unchanged from old approvals) ──────────────────────────

interface LegacyApproval {
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

type ActiveTab = 'razorpay' | 'legacy';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approvals.html',
  styleUrl: './approvals.scss',
})
export class Approvals implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  // ── Tab state ──────────────────────────────────────────────────────────────
  activeTab = signal<ActiveTab>('razorpay');

  // ── Razorpay queue state ───────────────────────────────────────────────────
  rzQueue = signal<RazorpayQueueItem[]>([]);
  rzLoading = signal(true);
  rzError = signal<string | null>(null);
  rzShowHistory = signal(false);

  rzSelected = signal<RazorpayQueueItem | null>(null);
  rzActivatingId = signal<number | null>(null);

  // Activate confirm modal
  rzShowConfirm = signal(false);
  rzConfirmNotes = '';
  rzConfirmTargetId = signal<number | null>(null);

  rzFilterStatus = signal<'PENDING' | 'ACTIVATED' | 'ALL'>('PENDING');

  rzFiltered = computed(() => {
    const all = this.rzQueue();
    const f = this.rzFilterStatus();
    if (f === 'ALL') return all;
    return all.filter((item) => item.activationStatus === f);
  });

  get rzPendingCount(): number {
    return this.rzQueue().filter((i) => i.activationStatus === 'PENDING').length;
  }

  // ── Legacy UTR state ───────────────────────────────────────────────────────
  legacyApprovals = signal<LegacyApproval[]>([]);
  legacyLoading = signal(true);
  legacyError = signal<string | null>(null);
  legacySelected = signal<LegacyApproval | null>(null);

  legacyApprovingId = signal<number | null>(null);
  legacyRejectingId = signal<number | null>(null);

  legacyShowRejectModal = signal(false);
  legacyRejectReason = '';
  legacyRejectTargetId = signal<number | null>(null);

  legacyShowApproveConfirm = signal(false);
  legacyApproveNotes = '';
  legacyApproveTargetId = signal<number | null>(null);

  legacyFilterStatus = signal<string>('SUBMITTED');

  legacyFiltered = computed(() => {
    const all = this.legacyApprovals();
    const status = this.legacyFilterStatus();
    if (status === 'ALL') return all;
    return all.filter((a) => a.status === status);
  });

  get legacyPendingCount(): number {
    return this.legacyApprovals().filter((a) => a.status === 'SUBMITTED').length;
  }

  readonly LEGACY_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    SUBMITTED: { label: 'Pending', cls: 'badge--amber' },
    VERIFIED: { label: 'Approved', cls: 'badge--green' },
    REJECTED: { label: 'Rejected', cls: 'badge--red' },
  };

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadRazorpayQueue();
    this.loadLegacyApprovals();
  }

  // ── Tab switching ──────────────────────────────────────────────────────────

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RAZORPAY QUEUE
  // ─────────────────────────────────────────────────────────────────────────

  loadRazorpayQueue(): void {
    this.rzLoading.set(true);
    this.rzError.set(null);

    const includeActivated = this.rzShowHistory();

    this.api
      .get<{ success: boolean; queue: RazorpayQueueItem[]; pendingCount: number }>(
        `approvals/razorpay${includeActivated ? '?includeActivated=true' : ''}`
      )
      .subscribe({
        next: (res) => {
          this.rzQueue.set(res.queue);
          // Refresh selected item if it's still in the list
          const sel = this.rzSelected();
          if (sel) {
            const updated = res.queue.find((i) => i.schoolId === sel.schoolId);
            this.rzSelected.set(updated ?? null);
          }
          this.rzLoading.set(false);
        },
        error: (err) => {
          this.rzError.set(err?.error?.error || 'Failed to load payment queue');
          this.rzLoading.set(false);
        },
      });
  }

  toggleRzHistory(): void {
    this.rzShowHistory.set(!this.rzShowHistory());
    this.rzFilterStatus.set(this.rzShowHistory() ? 'ALL' : 'PENDING');
    this.loadRazorpayQueue();
  }

  selectRzItem(item: RazorpayQueueItem): void {
    this.rzSelected.set(item);
  }

  setRzFilter(status: string): void {
    this.rzFilterStatus.set(status as 'PENDING' | 'ACTIVATED' | 'ALL');
  }

  // ── Activate flow ──────────────────────────────────────────────────────────

  openRzActivate(schoolId: number): void {
    this.rzConfirmTargetId.set(schoolId);
    this.rzConfirmNotes = '';
    this.rzShowConfirm.set(true);
  }

  closeRzActivate(): void {
    this.rzShowConfirm.set(false);
    this.rzConfirmTargetId.set(null);
    this.rzConfirmNotes = '';
  }

  confirmRzActivate(): void {
    const schoolId = this.rzConfirmTargetId();
    if (!schoolId) return;

    this.rzActivatingId.set(schoolId);
    this.rzShowConfirm.set(false);

    this.api
      .post<{ success: boolean; message: string; schoolCode: string; schoolName: string }>(
        `approvals/razorpay/${schoolId}/activate`,
        { internalNotes: this.rzConfirmNotes.trim() || undefined }
      )
      .subscribe({
        next: (res) => {
          this.rzActivatingId.set(null);
          this.toast.success(res.message || 'School activated successfully!');
          this.loadRazorpayQueue();
        },
        error: (err) => {
          this.rzActivatingId.set(null);
          this.toast.error(err?.error?.error || 'Activation failed. Please try again.');
        },
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY UTR QUEUE
  // ─────────────────────────────────────────────────────────────────────────

  loadLegacyApprovals(): void {
    this.legacyLoading.set(true);
    this.api
      .get<{ success: boolean; approvals: LegacyApproval[] }>('approvals')
      .subscribe({
        next: (res) => {
          this.legacyApprovals.set(res.approvals);
          const sel = this.legacySelected();
          if (sel) {
            const updated = res.approvals.find((a) => a.id === sel.id);
            this.legacySelected.set(updated ?? null);
          }
          this.legacyLoading.set(false);
        },
        error: () => {
          this.legacyError.set('Failed to load UTR records');
          this.legacyLoading.set(false);
        },
      });
  }

  selectLegacyApproval(a: LegacyApproval): void {
    this.legacySelected.set(a);
  }

  setLegacyFilter(status: string): void {
    this.legacyFilterStatus.set(status);
  }

  getLegacyStatusInfo(status: string) {
    return this.LEGACY_STATUS_LABELS[status] || { label: status, cls: 'badge--gray' };
  }

  // Legacy approve
  openLegacyApprove(id: number): void {
    this.legacyApproveTargetId.set(id);
    this.legacyApproveNotes = '';
    this.legacyShowApproveConfirm.set(true);
  }

  closeLegacyApprove(): void {
    this.legacyShowApproveConfirm.set(false);
    this.legacyApproveTargetId.set(null);
  }

  confirmLegacyApprove(): void {
    const id = this.legacyApproveTargetId();
    if (!id) return;

    this.legacyApprovingId.set(id);
    this.legacyShowApproveConfirm.set(false);

    this.api
      .post<any>(`approvals/${id}/approve`, { internalNotes: this.legacyApproveNotes })
      .subscribe({
        next: () => {
          this.legacyApprovingId.set(null);
          this.toast.success('Payment approved! School is now active.');
          this.loadLegacyApprovals();
        },
        error: (err) => {
          this.legacyApprovingId.set(null);
          this.toast.error(err?.error?.error || 'Failed to approve payment');
        },
      });
  }

  // Legacy reject
  openLegacyReject(id: number): void {
    this.legacyRejectTargetId.set(id);
    this.legacyRejectReason = '';
    this.legacyShowRejectModal.set(true);
  }

  closeLegacyReject(): void {
    this.legacyShowRejectModal.set(false);
    this.legacyRejectTargetId.set(null);
  }

  confirmLegacyReject(): void {
    const id = this.legacyRejectTargetId();
    if (!id || !this.legacyRejectReason.trim()) {
      this.toast.error('Please enter a rejection reason');
      return;
    }

    this.legacyRejectingId.set(id);
    this.legacyShowRejectModal.set(false);

    this.api
      .post<any>(`approvals/${id}/reject`, { rejectionReason: this.legacyRejectReason.trim() })
      .subscribe({
        next: () => {
          this.legacyRejectingId.set(null);
          this.toast.success('Payment rejected. School has been notified.');
          this.loadLegacyApprovals();
        },
        error: (err) => {
          this.legacyRejectingId.set(null);
          this.toast.error(err?.error?.error || 'Failed to reject payment');
        },
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED FORMATTERS
  // ─────────────────────────────────────────────────────────────────────────

  formatCurrency(paise: number | null, currency = 'INR'): string {
    if (!paise && paise !== 0) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  }

  formatMethod(method: string | null): string {
    if (!method) return '—';
    const map: Record<string, string> = {
      upi: 'UPI',
      card: 'Card',
      netbanking: 'Net Banking',
      wallet: 'Wallet',
      emi: 'EMI',
    };
    return map[method.toLowerCase()] ?? method;
  }

  timeSince(dateStr: string | null): string {
    if (!dateStr) return '—';
    const ms = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  daysSince(dateStr: string | null): string {
    if (!dateStr) return '—';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}