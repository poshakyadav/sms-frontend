// src/app/features/school/whatsapp/components/whatsapp-send/whatsapp-send.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CreditBalanceChip } from '../credit-balance-chip/credit-balance-chip';
import { NoCreditsBanner } from '../no-credits-banner/no-credits-banner';
import { TemplatePicker, TemplatePickerItem } from '../template-picker/template-picker';
import { VariableForm, VariableFormValue } from '../variable-form/variable-form';
import { TemplateBodyPreview } from '../template-body-preview/template-body-preview';
import { WhatsappService } from '../../../services/whatsapp.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { SendSingleInput, TemplateDefinition, WhatsappRecipientType } from '../../../types/whatsapp.types';


type SendStep = 'template' | 'details' | 'preview';

@Component({
  selector: 'app-whatsapp-send',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CreditBalanceChip,
    NoCreditsBanner,
    TemplatePicker,
    VariableForm,
    TemplateBodyPreview,
  ],
  templateUrl: './whatsapp-send.html',
  styleUrls: ['./whatsapp-send.scss'],
})
export class WhatsappSend implements OnInit {
  wa = inject(WhatsappService);
  private router = inject(Router);
  private toast = inject(ToastService);

  step = signal<SendStep>('template');
  selectedTemplate = signal<TemplateDefinition | null>(null);

  // Plain property (not a signal) — required for [(ngModel)] two-way binding.
  recipientType: WhatsappRecipientType = 'EXTERNAL';

  formValue = signal<VariableFormValue | null>(null);
  formValid = signal(false);

  isSubmitting = signal(false);
  submitError = signal<string | null>(null);

  readonly steps: { key: SendStep; label: string }[] = [
    { key: 'template', label: 'Template' },
    { key: 'details', label: 'Recipient & variables' },
    { key: 'preview', label: 'Preview & send' },
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

  stepIndex(key: SendStep): number {
    return this.steps.findIndex((s) => s.key === key);
  }

  onTemplateSelected(def: TemplateDefinition): void {
    this.selectedTemplate.set(def);
    this.formValue.set(null);
    this.formValid.set(false);
    this.submitError.set(null);
    this.step.set('details');
  }

  onFormChange(value: VariableFormValue | null): void {
    this.formValue.set(value);
  }
  onFormValidChange(valid: boolean): void {
    this.formValid.set(valid);
  }

  goToPreview(): void {
    if (!this.formValid()) return;
    this.step.set('preview');
  }

  backTo(step: SendStep): void {
    this.step.set(step);
  }

  get previewBodyText(): string {
    return this.selectedTemplate()?.bodyText ?? '';
  }
  get previewVariables(): string[] {
    return this.selectedTemplate()?.variables ?? [];
  }
  get previewTemplateName(): string {
    return this.selectedTemplate()?.name ?? '';
  }

  send(): void {
    const template = this.selectedTemplate();
    const value = this.formValue();
    if (!template || !value) return;

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const input: SendSingleInput = {
      templateKey: (template as any).key,
      recipientPhone: value.recipientPhone,
      recipientName: value.recipientName,
      recipientType: this.recipientType,
      variables: value.variables,
      triggeredByModule: 'manual',
    };

    this.wa.sendSingle(input).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success) {
          this.toast.success('Message sent successfully.');
          this.router.navigate(['/school/whatsapp/history']);
        } else {
          this.submitError.set(res.error || 'Failed to send the message. Please try again.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set(
          err?.error?.error || 'Failed to send the message. Please try again.'
        );
      },
    });
  }
}