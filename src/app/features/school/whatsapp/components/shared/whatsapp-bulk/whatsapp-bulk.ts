// src/app/features/school/whatsapp/components/whatsapp-bulk/whatsapp-bulk.ts
import { Component, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CreditBalanceChip } from '../credit-balance-chip/credit-balance-chip';
import { NoCreditsBanner } from '../no-credits-banner/no-credits-banner';
import { TemplatePicker, TemplatePickerItem } from '../template-picker/template-picker';
import { TargetSelection, TargetSelector } from '../target-selector/target-selector';
import { BulkConfirm } from '../bulk-confirm/bulk-confirm';
import { BulkProgress } from '../bulk-progress/bulk-progress';
import { WhatsappService } from '../../../services/whatsapp.service';
import { BulkSend, TemplateDefinition } from '../../../types/whatsapp.types';


type BulkStep = 'template' | 'audience' | 'confirm' | 'progress';

@Component({
  selector: 'app-whatsapp-bulk',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CreditBalanceChip,
    NoCreditsBanner,
    TemplatePicker,
    TargetSelector,
    BulkConfirm,
    BulkProgress,
  ],
  templateUrl: './whatsapp-bulk.html',
  styleUrls: ['./whatsapp-bulk.scss'],
})
export class WhatsappBulk implements OnInit {
  wa = inject(WhatsappService);

  @ViewChild(TargetSelector) targetSelectorRef?: TargetSelector;

  step = signal<BulkStep>('template');
  selectedTemplate = signal<TemplateDefinition | null>(null);
  targetSelection = signal<TargetSelection>({ targetType: 'ALL_PARENTS' });
  targetValid = signal(false);
  bulkTitle = signal('');
  bulkSendId = signal<number | null>(null);
  completedBulkSend = signal<BulkSend | null>(null);

  readonly steps: { key: BulkStep; label: string }[] = [
    { key: 'template', label: 'Template' },
    { key: 'audience', label: 'Audience' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'progress', label: 'Progress' },
  ];

  templateItems = computed<TemplatePickerItem[]>(() => {
    const defs = this.wa.definitions();
    const cached = this.wa.templates();
    return defs.map((def) => ({
      definition: def,
      cached: cached.find((t) => t.name === def.name),
    }));
  });

  ngOnInit(): void {
    if (this.wa.definitions().length === 0) {
      this.wa.loadTemplates().subscribe();
    }
    if (this.wa.balance() === null) {
      this.wa.loadBalance().subscribe();
    }
  }

  stepIndex(key: BulkStep): number {
    return this.steps.findIndex((s) => s.key === key);
  }

  onTemplateSelected(def: TemplateDefinition): void {
    this.selectedTemplate.set(def);
    this.step.set('audience');
  }

  onTargetSelectionChange(sel: TargetSelection): void {
    this.targetSelection.set(sel);
  }
  onTargetValidChange(valid: boolean): void {
    this.targetValid.set(valid);
  }

  proceedToConfirm(): void {
    if (!this.targetValid() || !this.targetSelectorRef) return;
    this.bulkTitle.set(this.targetSelectorRef.getBulkTitle());
    this.step.set('confirm');
  }

  onBulkInitiated(result: { bulkSendId: number }): void {
    this.bulkSendId.set(result.bulkSendId);
  }

  onSendStarted(): void {
    this.step.set('progress');
  }

  onProgressCompleted(bulk: BulkSend): void {
    this.completedBulkSend.set(bulk);
  }

  backTo(step: BulkStep): void {
    this.step.set(step);
  }
}