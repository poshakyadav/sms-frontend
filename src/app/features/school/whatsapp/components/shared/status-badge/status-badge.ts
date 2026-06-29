// status-badge.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  WhatsappMessageStatus,
  BulkSendStatus,
  STATUS_LABELS,
  BULK_STATUS_LABELS,
} from '../../../types/whatsapp.types';

type BadgeMode = 'message' | 'bulk';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="'badge--' + colorClass" [title]="label">
      <i class="ti {{ iconClass }}" aria-hidden="true"></i>
      {{ label }}
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;

        .ti {
          font-size: 12px;
        }

        &--queued {
          background: #f5f5f5;
          color: #616161;
        }
        &--sent {
          background: #e3f2fd;
          color: #1565c0;
        }
        &--delivered {
          background: #e0f2f1;
          color: #00695c;
        }
        &--read {
          background: #e8f5e9;
          color: #2e7d32;
        }
        &--failed {
          background: #ffebee;
          color: #b71c1c;
        }
        &--error {
          background: #fff3e0;
          color: #e65100;
        }
        &--sending {
          background: #e3f2fd;
          color: #1565c0;
        }
        &--partial {
          background: #fff8e1;
          color: #f57f17;
        }
        &--success {
          background: #e8f5e9;
          color: #2e7d32;
        }
        &--draft {
          background: #f5f5f5;
          color: #616161;
        }
        &--cancelled {
          background: #f5f5f5;
          color: #9e9e9e;
        }
      }
    `,
  ],
})
export class StatusBadge {
  @Input() status: WhatsappMessageStatus | BulkSendStatus = 'QUEUED';
  @Input() mode: BadgeMode = 'message';

  get label(): string {
    if (this.mode === 'bulk') {
      return BULK_STATUS_LABELS[this.status as BulkSendStatus] ?? this.status;
    }
    return STATUS_LABELS[this.status as WhatsappMessageStatus] ?? this.status;
  }

  get colorClass(): string {
    const map: Record<string, string> = {
      QUEUED: 'queued',
      SENT: 'sent',
      DELIVERED: 'delivered',
      READ: 'read',
      FAILED: 'failed',
      TEMPLATE_ERROR: 'error',
      DRAFT: 'draft',
      SENDING: 'sending',
      COMPLETED: 'success',
      PARTIAL: 'partial',
      CANCELLED: 'cancelled',
    };
    return map[this.status] ?? 'queued';
  }

  get iconClass(): string {
    const map: Record<string, string> = {
      QUEUED: 'ti-clock',
      SENT: 'ti-check',
      DELIVERED: 'ti-checks',
      READ: 'ti-eye',
      FAILED: 'ti-x',
      TEMPLATE_ERROR: 'ti-alert-triangle',
      DRAFT: 'ti-file',
      SENDING: 'ti-loader-2',
      COMPLETED: 'ti-circle-check',
      PARTIAL: 'ti-alert-circle',
      CANCELLED: 'ti-ban',
    };
    return map[this.status] ?? 'ti-circle';
  }
}
