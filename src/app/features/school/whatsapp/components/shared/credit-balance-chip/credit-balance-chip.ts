// src/app/features/school/whatsapp/components/shared/credit-balance-chip/credit-balance-chip.ts

import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-credit-balance-chip',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './credit-balance-chip.html',
  styleUrls: ['./credit-balance-chip.scss'],
})
export class CreditBalanceChip {
  @Input() creditsRemaining = 0;
  @Input() showBuyLink = true;
  @Input() compact = false;

  get tier(): 'healthy' | 'low' | 'critical' | 'empty' {
    if (this.creditsRemaining === 0) return 'empty';
    if (this.creditsRemaining < 5) return 'critical';
    if (this.creditsRemaining < 20) return 'low';
    return 'healthy';
  }

  get label(): string {
    if (this.creditsRemaining === 0) return 'No credits';
    return `${this.creditsRemaining.toLocaleString('en-IN')} credits`;
  }

  get icon(): string {
    switch (this.tier) {
      case 'empty':
        return 'ti-alert-circle';
      case 'critical':
        return 'ti-alert-triangle';
      case 'low':
        return 'ti-clock';
      default:
        return 'ti-brand-whatsapp';
    }
  }
}
