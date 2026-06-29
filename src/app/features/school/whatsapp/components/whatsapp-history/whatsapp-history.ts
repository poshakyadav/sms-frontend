// src/app/features/school/whatsapp/components/whatsapp-history/whatsapp-history.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WhatsappService } from '../../services/whatsapp.service';
import { MessageRow } from '../shared/message-row/message-row';
import { STATUS_LABELS } from '../../types/whatsapp.types';

@Component({
  selector: 'app-whatsapp-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageRow],
  templateUrl: './whatsapp-history.html',
  styleUrls: ['./whatsapp-history.scss'],
})
export class WhatsappHistory implements OnInit {
  wa = inject(WhatsappService);

  statusFilter = '';
  moduleFilter = '';
  pageSize = 25;
  offset = signal(0);

  readonly statusOptions = Object.entries(STATUS_LABELS);
  readonly moduleOptions = [
    { value: '', label: 'All modules' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'fees', label: 'Fees' },
    { value: 'exams', label: 'Exams' },
    { value: 'assignments', label: 'Assignments' },
    { value: 'bulk', label: 'Bulk send' },
    { value: 'manual', label: 'Manual' },
  ];

  ngOnInit(): void {
    this.load(true);
  }

  load(reset: boolean): void {
    if (reset) this.offset.set(0);
    this.wa
      .loadMessageHistory({
        limit: this.pageSize,
        offset: this.offset(),
        status: this.statusFilter || undefined,
        module: this.moduleFilter || undefined,
      })
      .subscribe();
  }

  applyFilters(): void {
    this.load(true);
  }

  get canGoPrev(): boolean {
    return this.offset() > 0;
  }

  prevPage(): void {
    this.offset.set(Math.max(0, this.offset() - this.pageSize));
    this.load(false);
  }

  nextPage(): void {
    if (this.wa.messageHistory().length === this.pageSize) {
      this.offset.set(this.offset() + this.pageSize);
      this.load(false);
    }
  }
}