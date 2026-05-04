// src/app/features/super/contact-messages/contact-messages.ts

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

export interface ContactMessage {
  id: number;
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  ownerUserId: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  category: 'TECHNICAL_ISSUE' | 'BILLING' | 'FEATURE_REQUEST' | 'ACCOUNT_ISSUE' | 'OTHER';
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
  internalNotes: string;
  resolvedBy: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-contact-messages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './contact-messages.html',
  styleUrl: './contact-messages.scss',
})
export class ContactMessages implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  // State
  loading = signal(true);
  messages = signal<ContactMessage[]>([]);
  selectedMessage = signal<ContactMessage | null>(null);
  panelOpen = signal(false);
  statusFilter = signal<string>('ALL');
  categoryFilter = signal<string>('ALL');
  searchQuery = signal('');
  updatingStatus = signal(false);
  savingNotes = signal(false);
  notesValue = signal('');

  readonly statusFilters = [
    { value: 'ALL', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly categoryFilters = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'TECHNICAL_ISSUE', label: 'Technical' },
    { value: 'BILLING', label: 'Billing' },
    { value: 'FEATURE_REQUEST', label: 'Feature Request' },
    { value: 'ACCOUNT_ISSUE', label: 'Account' },
    { value: 'OTHER', label: 'Other' },
  ];

  readonly statusConfig: Record<
    string,
    { label: string; color: string; bg: string; dotColor: string }
  > = {
    OPEN: { label: 'Open', color: '#2563eb', bg: '#eff6ff', dotColor: '#3b82f6' },
    IN_REVIEW: { label: 'In Review', color: '#d97706', bg: '#fffbeb', dotColor: '#f59e0b' },
    RESOLVED: { label: 'Resolved', color: '#059669', bg: '#f0fdf4', dotColor: '#10b981' },
    CLOSED: { label: 'Closed', color: '#6b7280', bg: '#f9fafb', dotColor: '#94a3b8' },
  };

  readonly categoryConfig: Record<
    string,
    { label: string; icon: string; color: string; bg: string }
  > = {
    TECHNICAL_ISSUE: { label: 'Technical Issue', icon: 'build', color: '#dc2626', bg: '#fef2f2' },
    BILLING: { label: 'Billing', icon: 'receipt', color: '#d97706', bg: '#fffbeb' },
    FEATURE_REQUEST: {
      label: 'Feature Request',
      icon: 'lightbulb',
      color: '#7c3aed',
      bg: '#faf5ff',
    },
    ACCOUNT_ISSUE: {
      label: 'Account Issue',
      icon: 'manage_accounts',
      color: '#2563eb',
      bg: '#eff6ff',
    },
    OTHER: { label: 'Other', icon: 'help_outline', color: '#6b7280', bg: '#f9fafb' },
  };

  filteredMessages = computed(() => {
    let list = this.messages();
    const status = this.statusFilter();
    const category = this.categoryFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (status !== 'ALL') list = list.filter((m) => m.status === status);
    if (category !== 'ALL') list = list.filter((m) => m.category === category);
    if (query) {
      list = list.filter(
        (m) =>
          m.schoolName.toLowerCase().includes(query) ||
          m.ownerName.toLowerCase().includes(query) ||
          m.subject.toLowerCase().includes(query) ||
          m.schoolCode.toLowerCase().includes(query)
      );
    }
    return list;
  });

  openCount = computed(() => this.messages().filter((m) => m.status === 'OPEN').length);
  inReviewCount = computed(() => this.messages().filter((m) => m.status === 'IN_REVIEW').length);

  canManage = computed(() => this.auth.hasSuperPermission('contact-messages.manage'));

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.loading.set(true);
    this.api
      .get<{ success: boolean; messages: ContactMessage[] }>('super/contact-messages')
      .subscribe({
        next: (res) => {
          this.messages.set(res.messages ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load contact messages');
          this.loading.set(false);
        },
      });
  }

  openPanel(msg: ContactMessage): void {
    this.selectedMessage.set(msg);
    this.notesValue.set(msg.internalNotes ?? '');
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    setTimeout(() => this.selectedMessage.set(null), 300);
  }

  updateStatus(status: string): void {
    const msg = this.selectedMessage();
    if (!msg || this.updatingStatus()) return;

    this.updatingStatus.set(true);
    this.api.patch(`super/contact-messages/${msg.id}/status`, { status }).subscribe({
      next: () => {
        this.toast.success(`Status updated to ${this.statusConfig[status]?.label}`);
        const updated = { ...msg, status: status as ContactMessage['status'] };
        this.selectedMessage.set(updated);
        this.messages.update((list) => list.map((m) => (m.id === msg.id ? updated : m)));
        this.updatingStatus.set(false);
      },
      error: () => {
        this.toast.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  saveNotes(): void {
    const msg = this.selectedMessage();
    if (!msg || this.savingNotes()) return;

    this.savingNotes.set(true);
    this.api
      .patch(`super/contact-messages/${msg.id}/notes`, { internalNotes: this.notesValue() })
      .subscribe({
        next: () => {
          this.toast.success('Notes saved');
          const updated = { ...msg, internalNotes: this.notesValue() };
          this.selectedMessage.set(updated);
          this.messages.update((list) => list.map((m) => (m.id === msg.id ? updated : m)));
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

  getReferenceId(id: number): string {
    return `MSG-${String(id).padStart(6, '0')}`;
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
      OPEN: ['IN_REVIEW', 'RESOLVED', 'CLOSED'],
      IN_REVIEW: ['RESOLVED', 'CLOSED', 'OPEN'],
      RESOLVED: ['CLOSED', 'IN_REVIEW'],
      CLOSED: ['OPEN'],
    };
    return (transitions[current] ?? []).map((s) => ({
      value: s,
      label: this.statusConfig[s]?.label ?? s,
    }));
  }
}
