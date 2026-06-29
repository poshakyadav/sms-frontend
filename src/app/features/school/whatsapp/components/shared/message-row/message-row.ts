// src/app/features/school/whatsapp/components/shared/message-row/message-row.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhatsappMessage } from '../../../types/whatsapp.types';
import { StatusBadge } from '../status-badge/status-badge';

@Component({
  selector: 'app-message-row',
  standalone: true,
  imports: [CommonModule, StatusBadge],
  templateUrl: './message-row.html',
  styleUrls: ['./message-row.scss'],
})
export class MessageRow {
  @Input({ required: true }) message!: WhatsappMessage;
}