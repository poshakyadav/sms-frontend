// shared/components/fee-status-badge/fee-status-badge.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FeeStatus } from '../../../core/services/fees.service';

@Component({
  selector: 'app-fee-status-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="fee-badge fee-badge--{{ status | lowercase }}">
      <mat-icon>{{ icon }}</mat-icon>
      {{ label }}
    </span>
  `,
  styleUrl: './fee-status-badge.scss',
})
export class FeeStatusBadge {
  @Input({ required: true }) status!: FeeStatus;

  get icon(): string {
    const map: Record<FeeStatus, string> = {
      PAID: 'check_circle',
      PARTIAL: 'timelapse',
      PENDING: 'schedule',
      OVERDUE: 'error',
    };
    return map[this.status] ?? 'help';
  }

  get label(): string {
    const map: Record<FeeStatus, string> = {
      PAID: 'Paid',
      PARTIAL: 'Partial',
      PENDING: 'Pending',
      OVERDUE: 'Overdue',
    };
    return map[this.status] ?? this.status;
  }
}
