// src/app/features/school/whatsapp/components/shared/bulk-confirm/bulk-confirm.ts
import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WhatsappService } from '../../../services/whatsapp.service';
import {
  TemplateDefinition,
  BulkInitiateInput,
  BulkInitiateResult,
} from '../../../types/whatsapp.types';
import { TargetSelection } from '../target-selector/target-selector';

@Component({
  selector: 'app-bulk-confirm',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './bulk-confirm.html',
  styleUrls: ['./bulk-confirm.scss'],
})
export class BulkConfirm implements OnInit {
  @Input({ required: true }) template!: TemplateDefinition;
  @Input({ required: true }) targetSelection!: TargetSelection;
  @Input({ required: true }) title!: string;

  @Output() initiated = new EventEmitter<{ bulkSendId: number }>();
  @Output() started = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private wa = inject(WhatsappService);

  isInitiating = signal(true);
  initiateError = signal<string | null>(null);
  result = signal<BulkInitiateResult | null>(null);

  isStarting = signal(false);
  startError = signal<string | null>(null);

  ngOnInit(): void {
    this.initiate();
  }

  /**
   * Per design: initiateBulk() (which resolves recipients AND reserves
   * credits) runs the moment the user arrives at this step — not on a
   * button click. The "Start sending" button only calls startBulk().
   */
  initiate(): void {
    this.isInitiating.set(true);
    this.initiateError.set(null);
    this.result.set(null);

    const input: BulkInitiateInput = {
      title: this.title,
      templateKey: (this.template as any).key,
      targetType: this.targetSelection.targetType,
      classSectionId: this.targetSelection.classSectionId,
      phoneList: this.targetSelection.phoneList,
      variableResolver: 'auto',
    };

    this.wa.initiateBulk(input).subscribe({
      next: (res) => {
        this.isInitiating.set(false);
        if (res.success) {
          this.result.set(res);
          this.initiated.emit({ bulkSendId: res.bulkSendId });
        } else {
          this.initiateError.set('Could not prepare the bulk send. Please try again.');
        }
      },
      error: (err) => {
        this.isInitiating.set(false);
        this.initiateError.set(
          err?.error?.error || 'Could not prepare the bulk send. Please try again.'
        );
      },
    });
  }

  start(): void {
    const r = this.result();
    if (!r) return;
    this.isStarting.set(true);
    this.startError.set(null);

    this.wa.startBulk(r.bulkSendId).subscribe({
      next: () => {
        this.isStarting.set(false);
        this.started.emit();
      },
      error: (err) => {
        this.isStarting.set(false);
        this.startError.set(err?.error?.error || 'Failed to start sending. Please try again.');
      },
    });
  }

  get isInsufficientCredits(): boolean {
    return !!this.initiateError()?.toLowerCase().includes('insufficient');
  }
}