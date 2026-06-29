// src/app/features/school/whatsapp/components/whatsapp-inbound/whatsapp-inbound.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhatsappService } from '../../services/whatsapp.service';

@Component({
  selector: 'app-whatsapp-inbound',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whatsapp-inbound.html',
  styleUrls: ['./whatsapp-inbound.scss'],
})
export class WhatsappInbound implements OnInit {
  wa = inject(WhatsappService);

  isLoading = signal(true);
  error = signal<string | null>(null);
  pageSize = 25;
  offset = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.wa.loadInbound(this.pageSize, this.offset()).subscribe({
      next: () => this.isLoading.set(false),
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.error || 'Failed to load inbound messages.');
      },
    });
  }

  prevPage(): void {
    this.offset.set(Math.max(0, this.offset() - this.pageSize));
    this.load();
  }
  nextPage(): void {
    if (this.wa.inboundMessages().length === this.pageSize) {
      this.offset.set(this.offset() + this.pageSize);
      this.load();
    }
  }
}