// src/app/features/school/contact-us/contact-us.ts

import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface ContactHistoryItem {
  id: number;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
}

interface ContactForm {
  category: string;
  subject: string;
  message: string;
  ownerPhone: string;
}

@Component({
  selector: 'app-contact-us',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatBadgeModule,
  ],
  templateUrl: './contact-us.html',
  styleUrl: './contact-us.scss',
})
export class ContactUs implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  loading = signal(false);
  historyLoading = signal(false);
  submitted = signal(false);
  errorMsg = signal('');
  referenceId = signal('');

  history = signal<ContactHistoryItem[]>([]);
  activeTab = signal<'form' | 'history'>('form');

  canSubmit = computed(() =>
    this.auth.isSchoolOwner() || this.auth.hasPermission('contact.submit')
  );

  form: ContactForm = {
    category: '',
    subject: '',
    message: '',
    ownerPhone: '',
  };

  readonly categories = [
    { value: 'TECHNICAL_ISSUE', label: 'Technical Issue', icon: 'build', color: '#ef4444' },
    { value: 'BILLING', label: 'Billing', icon: 'receipt', color: '#f59e0b' },
    { value: 'FEATURE_REQUEST', label: 'Feature Request', icon: 'lightbulb', color: '#8b5cf6' },
    { value: 'ACCOUNT_ISSUE', label: 'Account Issue', icon: 'manage_accounts', color: '#3b82f6' },
    { value: 'OTHER', label: 'Other', icon: 'help_outline', color: '#64748b' },
  ];

  readonly statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    OPEN: { label: 'Open', color: '#3b82f6', bg: '#eff6ff' },
    IN_REVIEW: { label: 'In Review', color: '#f59e0b', bg: '#fffbeb' },
    RESOLVED: { label: 'Resolved', color: '#10b981', bg: '#f0fdf4' },
    CLOSED: { label: 'Closed', color: '#64748b', bg: '#f8fafc' },
  };

  ngOnInit(): void {
    this.loadHistory();
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.api
      .get<{ success: boolean; messages: ContactHistoryItem[] }>('school/contact/my')
      .subscribe({
        next: (res) => {
          this.history.set(res.messages ?? []);
          this.historyLoading.set(false);
        },
        error: () => this.historyLoading.set(false),
      });
  }

  isFormValid(): boolean {
    const f = this.form;
    return !!(f.category && f.subject.trim().length >= 5 && f.message.trim().length >= 20);
  }

  getCategoryConfig(value: string) {
    return this.categories.find((c) => c.value === value);
  }

  getStatusConfig(status: string) {
    return this.statusConfig[status] ?? this.statusConfig['OPEN'];
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    const payload: any = {
      category: this.form.category,
      subject: this.form.subject.trim(),
      message: this.form.message.trim(),
    };

    if (this.form.ownerPhone.trim()) {
      payload.ownerPhone = this.form.ownerPhone.trim();
    }

    try {
      const res: any = await this.api.post('school/contact/submit', payload).toPromise();
      this.referenceId.set(res.referenceId ?? '');
      this.submitted.set(true);
      // Reload history
      this.loadHistory();
    } catch (err: any) {
      this.errorMsg.set(err?.error?.error || 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.form = { category: '', subject: '', message: '', ownerPhone: '' };
    this.submitted.set(false);
    this.referenceId.set('');
    this.errorMsg.set('');
  }
}
