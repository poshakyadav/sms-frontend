// src/app/features/super/school-requests/school-requests.ts

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { FilteredCountPipe } from '../../../shared/pipes/filtered-count-pipe';

export interface RegistrationRequest {
  id: number;
  schoolName: string;
  schoolType: 'PRIMARY' | 'SECONDARY' | 'HIGHER_SECONDARY' | 'OTHER';
  city: string;
  state: string;
  estimatedStudents: number | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  message: string;
  status: 'PENDING' | 'REVIEWED' | 'INVITED' | 'REJECTED' | 'DUPLICATE';
  internalNotes: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  convertedToInvitationId: number | null;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-school-requests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FilteredCountPipe
  ],
  templateUrl: './school-requests.html',
  styleUrl: './school-requests.scss',
})
export class SchoolRequests implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  // State
  loading = signal(true);
  requests = signal<RegistrationRequest[]>([]);
  selectedRequest = signal<RegistrationRequest | null>(null);
  panelOpen = signal(false);
  statusFilter = signal<string>('ALL');
  searchQuery = signal('');
  updatingStatus = signal(false);
  savingNotes = signal(false);
  notesValue = signal('');

  readonly statusFilters = [
    { value: 'ALL', label: 'All Requests' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'REVIEWED', label: 'Reviewed' },
    { value: 'INVITED', label: 'Invited' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'DUPLICATE', label: 'Duplicate' },
  ];

  readonly schoolTypeLabels: Record<string, string> = {
    PRIMARY: 'Primary',
    SECONDARY: 'Secondary',
    HIGHER_SECONDARY: 'Higher Secondary',
    OTHER: 'Other',
  };

  readonly statusConfig: Record<
    string,
    { label: string; color: string; bg: string; dotColor: string }
  > = {
    PENDING: { label: 'Pending', color: '#d97706', bg: '#fffbeb', dotColor: '#f59e0b' },
    REVIEWED: { label: 'Reviewed', color: '#2563eb', bg: '#eff6ff', dotColor: '#3b82f6' },
    INVITED: { label: 'Invited', color: '#059669', bg: '#f0fdf4', dotColor: '#10b981' },
    REJECTED: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', dotColor: '#ef4444' },
    DUPLICATE: { label: 'Duplicate', color: '#6b7280', bg: '#f9fafb', dotColor: '#94a3b8' },
  };

  filteredRequests = computed(() => {
    let list = this.requests();
    const filter = this.statusFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (filter !== 'ALL') {
      list = list.filter((r) => r.status === filter);
    }
    if (query) {
      list = list.filter(
        (r) =>
          r.schoolName.toLowerCase().includes(query) ||
          r.ownerName.toLowerCase().includes(query) ||
          r.ownerEmail.toLowerCase().includes(query) ||
          r.city.toLowerCase().includes(query) ||
          r.state.toLowerCase().includes(query)
      );
    }
    return list;
  });

  pendingCount = computed(() => this.requests().filter((r) => r.status === 'PENDING').length);

  canManage = computed(() => this.auth.hasSuperPermission('school-requests.manage'));

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading.set(true);
    this.api
      .get<{ success: boolean; requests: RegistrationRequest[] }>('super/school-requests')
      .subscribe({
        next: (res) => {
          this.requests.set(res.requests ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load registration requests');
          this.loading.set(false);
        },
      });
  }

  openPanel(request: RegistrationRequest): void {
    this.selectedRequest.set(request);
    this.notesValue.set(request.internalNotes ?? '');
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    setTimeout(() => this.selectedRequest.set(null), 300);
  }

  updateStatus(status: string): void {
    const req = this.selectedRequest();
    if (!req || this.updatingStatus()) return;

    this.updatingStatus.set(true);
    this.api.patch(`super/school-requests/${req.id}/status`, { status }).subscribe({
      next: () => {
        this.toast.success(`Status updated to ${this.statusConfig[status]?.label}`);
        const updated = { ...req, status: status as RegistrationRequest['status'] };
        this.selectedRequest.set(updated);
        this.requests.update((list) => list.map((r) => (r.id === req.id ? updated : r)));
        this.updatingStatus.set(false);
      },
      error: () => {
        this.toast.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  saveNotes(): void {
    const req = this.selectedRequest();
    if (!req || this.savingNotes()) return;

    this.savingNotes.set(true);
    this.api
      .patch(`super/school-requests/${req.id}/notes`, { internalNotes: this.notesValue() })
      .subscribe({
        next: () => {
          this.toast.success('Notes saved');
          const updated = { ...req, internalNotes: this.notesValue() };
          this.selectedRequest.set(updated);
          this.requests.update((list) => list.map((r) => (r.id === req.id ? updated : r)));
          this.savingNotes.set(false);
        },
        error: () => {
          this.toast.error('Failed to save notes');
          this.savingNotes.set(false);
        },
      });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  getNextStatuses(current: string): { value: string; label: string }[] {
    const transitions: Record<string, string[]> = {
      PENDING: ['REVIEWED', 'REJECTED', 'DUPLICATE'],
      REVIEWED: ['INVITED', 'REJECTED', 'DUPLICATE'],
      INVITED: ['REJECTED'],
      REJECTED: ['REVIEWED'],
      DUPLICATE: ['REVIEWED'],
    };
    return (transitions[current] ?? []).map((s) => ({
      value: s,
      label: this.statusConfig[s]?.label ?? s,
    }));
  }
}
