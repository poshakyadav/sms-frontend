// src/app/features/school/whatsapp/components/shared/bulk-stats/bulk-stats.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BulkSend } from '../../../types/whatsapp.types';
import { StatusBadge } from '../status-badge/status-badge';

@Component({
  selector: 'app-bulk-stats',
  standalone: true,
  imports: [CommonModule, StatusBadge],
  templateUrl: './bulk-stats.html',
  styleUrls: ['./bulk-stats.scss'],
})
export class BulkStats {
  @Input({ required: true }) bulkSend!: BulkSend;

  get progressPercent(): number {
    if (!this.bulkSend || this.bulkSend.totalRecipients === 0) return 0;
    return Math.round((this.bulkSend.sentCount / this.bulkSend.totalRecipients) * 100);
  }
}