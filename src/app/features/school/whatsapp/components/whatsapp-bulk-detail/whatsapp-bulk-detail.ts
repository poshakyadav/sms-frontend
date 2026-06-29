// src/app/features/school/whatsapp/components/whatsapp-bulk-detail/whatsapp-bulk-detail.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WhatsappService } from '../../services/whatsapp.service';
import { BulkStats } from '../shared/bulk-stats/bulk-stats';
import { MessageRow } from '../shared/message-row/message-row';
import { BulkSend, WhatsappMessage } from '../../types/whatsapp.types';

@Component({
  selector: 'app-whatsapp-bulk-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, BulkStats, MessageRow],
  templateUrl: './whatsapp-bulk-detail.html',
  styleUrls: ['./whatsapp-bulk-detail.scss'],
})
export class WhatsappBulkDetail implements OnInit {
  private route = inject(ActivatedRoute);
  wa = inject(WhatsappService);

  bulkSendId = signal<number | null>(null);
  bulkSend = signal<BulkSend | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // Now scoped exactly to this bulk send via /messages?bulkSendId=<id>
  relatedMessages = signal<WhatsappMessage[]>([]);
  isLoadingMessages = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || isNaN(id)) {
      this.error.set('Invalid bulk send ID.');
      this.isLoading.set(false);
      return;
    }
    this.bulkSendId.set(id);
    this.load(id);
  }

  load(id: number): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.wa.getBulkStatus(id).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.bulkSend) {
          this.bulkSend.set(res.bulkSend);
          this.loadRelatedMessages(id);
        } else {
          this.error.set('Bulk send not found.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.error || 'Failed to load bulk send.');
      },
    });
  }

  private loadRelatedMessages(bulkSendId: number): void {
    this.isLoadingMessages.set(true);
    this.wa.loadMessageHistory({ bulkSendId, limit: 100 }).subscribe({
      next: () => {
        this.isLoadingMessages.set(false);
        this.relatedMessages.set(this.wa.messageHistory());
      },
      error: () => {
        this.isLoadingMessages.set(false);
      },
    });
  }

  refresh(): void {
    const id = this.bulkSendId();
    if (id) this.load(id);
  }
}