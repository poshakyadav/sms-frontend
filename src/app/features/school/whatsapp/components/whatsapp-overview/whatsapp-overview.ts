// whatsapp-overview.ts
import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { WhatsappService } from '../../services/whatsapp.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { BillingService } from '../../../../../core/services/billing.service';
import { CreditBalanceChip } from '../shared/credit-balance-chip/credit-balance-chip';
import { StatusBadge } from '../shared/status-badge/status-badge';
import { TemplatePickerItem } from '../shared/template-picker/template-picker';
import { WhatsappMessage } from '../../types/whatsapp.types';

@Component({
  selector: 'app-whatsapp-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, CreditBalanceChip, StatusBadge],
  templateUrl: './whatsapp-overview.html',
  styleUrls: ['./whatsapp-overview.scss'],
})
export class WhatsappOverview implements OnInit {
  wa = inject(WhatsappService);
  auth = inject(AuthService);
  billing = inject(BillingService);

  isLoading = true;
  error: string | null = null;

  canManage = computed(() => this.auth.hasPermission('billing.manage'));

  // Merge definitions with their cached status
  templateItems = computed<TemplatePickerItem[]>(() => {
    const defs = this.wa.definitions();
    const cached = this.wa.templates();
    return defs.map((def) => ({
      definition: def,
      cached: cached.find((t) => t.name === def.name),
    }));
  });

  recentMessages = computed(() => this.wa.messageHistory().slice(0, 5));

  ngOnInit(): void {
    forkJoin({
      balance: this.wa.loadBalance(),
      templates: this.wa.loadTemplates(),
      history: this.wa.loadMessageHistory({ limit: 5 }),
    }).subscribe({
      next: () => { this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || 'Failed to load WhatsApp data.';
      },
    });
  }

  syncTemplates(): void {
    this.wa.syncTemplates().subscribe();
  }

  approvedCount = computed(() => this.wa.approvedTemplates().length);
  totalCount = computed(() => this.wa.definitions().length);
}