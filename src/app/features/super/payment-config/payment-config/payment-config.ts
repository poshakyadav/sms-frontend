// features/super/payment-config/payment-config.ts
//
// RAZORPAY-ONLY setup fee configuration.
// The legacy UPI ID / QR code UTR-based flow has been fully retired from this
// screen — Razorpay handles all payment collection now. The underlying DB
// columns (upiId, qrCodeUrl) are left untouched for historical reasons but
// are no longer read, written, or shown anywhere in this component.

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
  setupFeeAmount: number; // paise — sticker price
  setupFeeDiscountPaise: number; // paise — flat discount
  setupFeeFinalAmountPaise: number; // paise — computed server-side, read-only here
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

  constructor(private fb: FormBuilder, private api: ApiService, private toast: ToastService) {
    this.form = this.fb.group({
      // Sticker price, entered in ₹ for human convenience, stored as paise.
      setupFeeAmountRupees: [0, [Validators.required, Validators.min(0)]],
      // Flat discount, also entered in ₹ for symmetry with the price field.
      setupFeeDiscountRupees: [0, [Validators.min(0)]],
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
    this.error.set(null);
    this.api.get<{ success: boolean; config: PaymentConfig }>('payment-config').subscribe({
      next: (res) => {
        this.config.set(res.config);
        this.form.patchValue({
          setupFeeAmountRupees: res.config.setupFeeAmount ? res.config.setupFeeAmount / 100 : 0,
          setupFeeDiscountRupees: res.config.setupFeeDiscountPaise
            ? res.config.setupFeeDiscountPaise / 100
            : 0,
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

  // ── Live computed values, mirroring backend's setupFeeFinalAmountPaise math ──
  // (amountPaise - discountPaise), purely for instant UI feedback. The actual
  // persisted value is always recomputed server-side on save — this is just
  // a preview so the admin sees the real final price before hitting Save.

  get amountRupees(): number {
    return Number(this.form.get('setupFeeAmountRupees')?.value) || 0;
  }

  get discountRupees(): number {
    return Number(this.form.get('setupFeeDiscountRupees')?.value) || 0;
  }

  get computedFinalRupees(): number {
    const final = this.amountRupees - this.discountRupees;
    return final > 0 ? final : 0;
  }

  get discountExceedsAmount(): boolean {
    return this.discountRupees > this.amountRupees;
  }

  get feePreview(): string {
    if (!this.form.get('isFeeEnabled')?.value) return 'Free / Waived';
    const rupees = this.computedFinalRupees;
    if (rupees <= 0) return 'Free / Waived';
    return `₹${rupees.toLocaleString('en-IN')}`;
  }

  get stickerPricePreview(): string {
    const rupees = this.amountRupees;
    if (rupees <= 0) return '₹0';
    return `₹${rupees.toLocaleString('en-IN')}`;
  }

  get hasDiscount(): boolean {
    return this.discountRupees > 0 && !this.discountExceedsAmount;
  }

  save() {
    if (this.form.invalid || this.discountExceedsAmount) {
      this.form.markAllAsTouched();
      if (this.discountExceedsAmount) {
        this.toast.error('Discount cannot be greater than the setup fee amount.');
      }
      return;
    }

    this.saving.set(true);
    this.saveSuccess.set(false);

    const raw = this.form.value;
    const payload = {
      setupFeeAmount: Math.round(raw.setupFeeAmountRupees * 100), // ₹ → paise
      setupFeeDiscountPaise: Math.round((raw.setupFeeDiscountRupees || 0) * 100), // ₹ → paise
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
}