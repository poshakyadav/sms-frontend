// features/public/pricing/pricing.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface PricingFeature {
  label: string;
  monthly: boolean | string;
  yearly: boolean | string;
  highlight?: boolean;
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {
  activeFaq = signal<number | null>(null);

  // ── Core pricing constants ────────────────────────────────────────
  readonly setupFee = 5000;

  readonly monthlyPrice = 599;

  readonly yearlyPrice = 6988;
  readonly yearlyOriginalPrice = 7188;
  readonly yearlySavingsPercent = 3;

  get setupFeeFormatted(): string {
    return this.setupFee.toLocaleString('en-IN');
  }

  get monthlyPriceFormatted(): string {
    return this.monthlyPrice.toLocaleString('en-IN');
  }

  get yearlyPriceFormatted(): string {
    return this.yearlyPrice.toLocaleString('en-IN');
  }

  get yearlyOriginalPriceFormatted(): string {
    return this.yearlyOriginalPrice.toLocaleString('en-IN');
  }

  get yearlyMonthlyEquivalentFormatted(): string {
    return (this.yearlyPrice / 12).toFixed(2);
  }

  // ── Feature comparison ────────────────────────────────────────────
  readonly features: PricingFeature[] = [
    { label: 'All platform features (no paywalls)', monthly: true, yearly: true },
    { label: 'Unlimited students, parents & staff', monthly: true, yearly: true },
    { label: 'Attendance tracking & reports', monthly: true, yearly: true },
    { label: 'Exam & assignment management', monthly: true, yearly: true },
    { label: 'Fee collection & ledger (Razorpay)', monthly: true, yearly: true },
    { label: 'WhatsApp messaging & notifications', monthly: true, yearly: true },
    { label: 'Multi-role access control', monthly: true, yearly: true },
    { label: 'Custom school branding', monthly: true, yearly: true },
    { label: 'Pay Once or UPI Autopay', monthly: true, yearly: true },
    { label: 'Billing cycle', monthly: 'Every 30 days', yearly: 'Every 365 days' },
    {
      label: 'Effective monthly cost',
      monthly: `₹${this.monthlyPrice}/mo`,
      yearly: `₹${this.yearlyMonthlyEquivalentFormatted}/mo`,
      highlight: true,
    },
    {
      label: 'Priority support & SLA',
      monthly: 'Standard',
      yearly: 'Priority SLA',
      highlight: true,
    },
  ];

  // ── FAQs ──────────────────────────────────────────────────────────
  readonly faqs = [
    {
      q: 'What does the one-time setup fee cover?',
      a: `The ₹${this.setupFeeFormatted} setup fee covers dedicated database provisioning, school environment configuration, and onboarding support. It's charged once via Razorpay when you register your school, separate from your subscription.`,
    },
    {
      q: 'What\'s the difference between Monthly and Yearly plans?',
      a: `Both plans unlock the complete Eduxo platform — there's no feature difference. Monthly billing renews every 30 days at ₹${this.monthlyPriceFormatted}. Yearly billing renews every 365 days at ₹${this.yearlyPriceFormatted} (equivalent to ₹${this.yearlyMonthlyEquivalentFormatted}/month), saving you ${this.yearlySavingsPercent}% and including priority support.`,
    },
    {
      q: 'What is UPI Autopay, and do I have to use it?',
      a: 'UPI Autopay lets your subscription renew automatically each cycle without a manual payment. If you\'d rather stay in control, choose "Pay Once" instead and renew manually — both options are available on Monthly and Yearly plans.',
    },
    {
      q: 'What happens when our access expires?',
      a: 'Your Billing dashboard shows a live countdown as your access period nears its end. Renewing — early or after expiry — simply extends your access, and any time already paid for is never lost.',
    },
    {
      q: 'Is the setup fee refundable?',
      a: 'The setup fee is non-refundable once your school environment has been provisioned, since it covers dedicated setup work. We\'re happy to walk your team through the platform before you commit.',
    },
    {
      q: 'How many students, parents, and staff can we add?',
      a: 'Unlimited, on every plan. There are no per-seat charges — one flat subscription covers your entire school community.',
    },
  ];

  toggleFaq(index: number): void {
    this.activeFaq.update((v) => (v === index ? null : index));
  }
}