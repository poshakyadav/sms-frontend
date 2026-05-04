// features/super/payment-config/payment-config.ts

import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

interface PaymentConfig {
  id: number | null;
  upiId: string;
  qrCodeUrl: string;
  setupFeeAmount: number; // paise
  currency: string;
  feeDescription: string;
  isFeeEnabled: boolean;
}

@Component({
  selector: 'app-payment-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './payment-config.html',
  styleUrl: './payment-config.scss',
})
export class PaymentConfigComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  saveSuccess = signal(false);

  config = signal<PaymentConfig | null>(null);
  form: FormGroup;

  // For display: the rupee value from the form's paise field
  get feeInRupees(): number {
    return Math.round(this.form.get('setupFeeAmountRupees')?.value || 0);
  }

  constructor(private fb: FormBuilder, private api: ApiService, private toast: ToastService) {
    this.form = this.fb.group({
      upiId: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      qrCodeUrl: ['', [Validators.pattern(/^(https?:\/\/).+/)]],
      setupFeeAmountRupees: [0, [Validators.required, Validators.min(0)]],
      currency: ['INR'],
      feeDescription: [
        '',
        [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
      ],
      isFeeEnabled: [true],
    });
  }

  ngOnInit() {
    this.loadConfig();
  }

  loadConfig() {
    this.loading.set(true);
    this.api.get<{ success: boolean; config: PaymentConfig }>('payment-config').subscribe({
      next: (res) => {
        this.config.set(res.config);
        this.form.patchValue({
          upiId: res.config.upiId || '',
          qrCodeUrl: res.config.qrCodeUrl || '',
          setupFeeAmountRupees: res.config.setupFeeAmount ? res.config.setupFeeAmount / 100 : 0,
          currency: res.config.currency || 'INR',
          feeDescription: res.config.feeDescription || '',
          isFeeEnabled: res.config.isFeeEnabled ?? true,
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load payment configuration');
        this.loading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveSuccess.set(false);

    const raw = this.form.value;
    const payload = {
      upiId: raw.upiId.trim(),
      qrCodeUrl: raw.qrCodeUrl?.trim() || '',
      setupFeeAmount: Math.round(raw.setupFeeAmountRupees * 100), // convert ₹ to paise
      currency: raw.currency || 'INR',
      feeDescription: raw.feeDescription.trim(),
      isFeeEnabled: raw.isFeeEnabled,
    };

    this.api.put<{ success: boolean; config: PaymentConfig }>('payment-config', payload).subscribe({
      next: (res) => {
        this.config.set(res.config);
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.toast.success('Payment configuration saved successfully!');
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error || 'Failed to save configuration');
      },
    });
  }

  get feePreview(): string {
    const rupees = this.form.get('setupFeeAmountRupees')?.value || 0;
    if (rupees <= 0) return 'Free / Waived';
    return `₹${Number(rupees).toLocaleString('en-IN')}`;
  }
}
