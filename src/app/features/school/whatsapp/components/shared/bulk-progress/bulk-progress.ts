// bulk-progress.ts
import { Component, Input, OnInit, OnDestroy, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BulkSend, BulkSendStatus } from '../../../types/whatsapp.types';
import { WhatsappService } from '../../../services/whatsapp.service';
import { StatusBadge } from '../status-badge/status-badge';

@Component({
  selector: 'app-bulk-progress',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadge],
  templateUrl: './bulk-progress.html',
  styleUrls: ['./bulk-progress.scss'],
})
export class BulkProgress implements OnInit, OnDestroy {
  @Input({ required: true }) bulkSendId!: number;
  @Output() completed = new EventEmitter<BulkSend>();

  private wa = inject(WhatsappService);
  private sub: Subscription | null = null;

  bulkSend: BulkSend | null = null;
  isPolling = true;
  pollError: string | null = null;

  ngOnInit(): void {
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private startPolling(): void {
    this.isPolling = true;
    this.pollError = null;

    this.sub = this.wa.pollBulkStatus(this.bulkSendId).subscribe({
      next: (bulk) => {
        this.bulkSend = bulk;
        if (this.isTerminal(bulk.status)) {
          this.isPolling = false;
          this.completed.emit(bulk);
        }
      },
      error: (err) => {
        this.isPolling = false;
        this.pollError = 'Could not fetch send progress. Please refresh.';
      },
    });
  }

  isTerminal(status: BulkSendStatus): boolean {
    return ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(status);
  }

  get progressPercent(): number {
    if (!this.bulkSend || this.bulkSend.totalRecipients === 0) return 0;
    return Math.round((this.bulkSend.sentCount / this.bulkSend.totalRecipients) * 100);
  }

  get deliveredPercent(): number {
    if (!this.bulkSend || this.bulkSend.totalRecipients === 0) return 0;
    return Math.round((this.bulkSend.deliveredCount / this.bulkSend.totalRecipients) * 100);
  }

  get statusIcon(): string {
    const status = this.bulkSend?.status;
    if (!status) return 'ti-loader-2';
    const map: Record<string, string> = {
      SENDING: 'ti-loader-2',
      COMPLETED: 'ti-circle-check',
      PARTIAL: 'ti-alert-circle',
      FAILED: 'ti-circle-x',
      CANCELLED: 'ti-ban',
    };
    return map[status] ?? 'ti-loader-2';
  }

  get statusAnimated(): boolean {
    return this.bulkSend?.status === 'SENDING';
  }
}