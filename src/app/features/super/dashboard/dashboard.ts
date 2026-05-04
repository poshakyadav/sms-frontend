// features/super/dashboard/dashboard.ts

import { Component, signal, computed, OnInit } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';
import { Router } from '@angular/router';

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: { roleName: string; count: number }[];
  };
  schools: {
    total: number;
    active: number;
    inactive: number;
    withDatabase: number;
    withoutDatabase: number;
  };
  databases: {
    total: number;
    assigned: number;
    available: number;
  };
  generatedAt: string;
}

interface PendingApproval {
  id: number;
  schoolName: string;
  utrNumber: string | null;
  submittedAt: string | null;
  status: string;
}

// Quick action definition — resolved once at render time, no structural directive
interface QuickAction {
  icon: string;
  label: string;
  page: string;
  colorClass: string;
  highlight?: boolean;
  badgeCount?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  error = signal(false);

  // Payment system stats
  pendingApprovals = signal<PendingApproval[]>([]);
  loadingApprovals = signal(false);

  dbUtilizationPct = computed(() => {
    const s = this.stats();
    if (!s || s.databases.total === 0) return 0;
    return Math.round((s.databases.assigned / s.databases.total) * 100);
  });

  schoolSetupPct = computed(() => {
    const s = this.stats();
    if (!s || s.schools.total === 0) return 0;
    return Math.round((s.schools.withDatabase / s.schools.total) * 100);
  });

  pendingApprovalCount = computed(() => this.pendingApprovals().length);

  // ── Quick actions resolved from permissions — no structural directive ─────
  quickActions = computed<QuickAction[]>(() => {
    const pending = this.pendingApprovalCount();
    const actions: QuickAction[] = [];
 
    if (this.auth.hasAnySuperPermission(['schools.invite', '*'])) {
      actions.push({ icon: 'envelope', label: 'Send invitations', page: 'invitations', colorClass: 'indigo' });
    }
    if (this.auth.hasAnySuperPermission(['schools.manage', '*'])) {
      actions.push({ icon: 'check', label: 'Payment approvals', page: 'approvals', colorClass: 'green', highlight: true, badgeCount: pending > 0 ? pending : undefined });
    }
    if (this.auth.hasAnySuperPermission(['payments.config', '*'])) {
      actions.push({ icon: 'card', label: 'Payment config', page: 'payment-config', colorClass: 'amber' });
    }
    if (this.auth.hasAnySuperPermission(['users.list', '*'])) {
      actions.push({ icon: 'user', label: 'Manage users', page: 'users', colorClass: 'blue' });
    }
    if (this.auth.hasAnySuperPermission(['roles.manage', '*'])) {
      actions.push({ icon: 'shield', label: 'Manage roles', page: 'roles', colorClass: 'purple' });
    }
    if (this.auth.hasAnySuperPermission(['turso.manage', '*'])) {
      actions.push({ icon: 'db', label: 'Turso databases', page: 'turso-dbs', colorClass: 'amber' });
    }
    return actions;
  });

  // ── Permission helpers for template ──────────────────────────────────────
  canSeeApprovals = computed(() => this.auth.hasAnySuperPermission(['schools.manage', '*']));
 

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.auth.isAuthenticated()) {
      this.auth.logout();
      return;
    }
    this.fetchStats();
    this.fetchPendingApprovals();
  }

  fetchStats() {
    this.loading.set(true);
    this.error.set(false);
    this.api.get<{ success: boolean; stats: DashboardStats }>('dashboard/stats').subscribe({
      next: (res) => {
        this.stats.set(res.stats);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.toast.error('Failed to load dashboard stats');
      },
    });
  }

  fetchPendingApprovals() {
    // Only fetch if user has permission
    if (!this.auth.hasAnySuperPermission(['schools.manage', '*'])) return;
    this.loadingApprovals.set(true);
    this.api.get<{ success: boolean; approvals: PendingApproval[] }>('approvals').subscribe({
      next: (res) => {
        const pending = res.approvals.filter((a) => a.status === 'SUBMITTED');
        this.pendingApprovals.set(pending);
        this.loadingApprovals.set(false);
      },
      error: () => {
        this.loadingApprovals.set(false);
      },
    });
  }

  refresh() {
    this.fetchStats();
    this.fetchPendingApprovals();
  }

  navigateTo(page: string) {
    this.router.navigate([`/super/${page}`]);
  }

  daysSince(dateStr: string | null): string {
    if (!dateStr) return '—';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }
}
