// features/public/pricing/pricing.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface PricingFeature {
  label: string;
  standard: boolean | string;
  premium: boolean | string;
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

  readonly setupFee = 4900;
  readonly monthlyFee = 1150;

  readonly features: PricingFeature[] = [
    { label: 'All platform features (no paywalls)', standard: true, premium: true },
    { label: 'Unlimited student & parent accounts', standard: true, premium: true },
    { label: 'Attendance tracking & reports', standard: true, premium: true },
    { label: 'Exam & assignment management', standard: true, premium: true },
    { label: 'Fee collection & ledger', standard: true, premium: true },
    { label: 'Multi-role access control', standard: true, premium: true },
    { label: 'Notifications & announcements', standard: true, premium: true },
    {
      label: '100% Distraction-Free Campus Environment',
      standard: false,
      premium: true,
      highlight: false,
    },
    {
      label: 'Custom school branding',
      standard: true,
      premium: true,
    },
    {
      label: 'Priority support & SLA',
      standard: 'Standard',
      premium: 'Priority SLA',
    },
    {
      label: 'Contextual educational partner notices',
      standard: true,
      premium: false,
    },
  ];

  readonly faqs = [
    {
      q: 'What does the Standard (Community) plan actually cost my school?',
      a: `The one-time implementation fee of ₹${this.setupFee.toLocaleString(
        'en-IN'
      )} is the only charge. After that, the Standard plan is ₹0/month — forever. You get full access to every feature on the platform with zero monthly overhead.`,
    },
    {
      q: 'What are "educational partner notices" on the Standard plan?',
      a: 'To keep the platform fully accessible without a paywall, the Standard plan displays highly vetted, family-safe, education-focused notices — such as book recommendations, scholarship opportunities, and learning tools. We strictly adhere to student data privacy laws and never show behavioural, targeted, or harmful advertising. Every notice is reviewed before it goes live.',
    },
    {
      q: 'Can we upgrade from Standard to Premium later?',
      a: 'Absolutely. You can transition your entire school network to a completely distraction-free, ad-free environment at any time — directly from your Admin Dashboard. The upgrade takes effect immediately, pro-rated to the day.',
    },
    {
      q: 'Is the one-time implementation fee non-refundable?',
      a: 'The implementation fee covers database provisioning, onboarding configuration, and dedicated setup support. Once your school environment is deployed, the cost is non-refundable — but we offer a free 30-day walkthrough to ensure your team is fully comfortable before go-live.',
    },
    {
      q: 'Are student data and privacy protected on the Standard plan?',
      a: 'Yes, unconditionally. We comply with the Digital Personal Data Protection (DPDP) Act. We use only static, contextual notices — never behavioural tracking or profiling of minors. Student data is never sold or shared with advertising partners under any circumstances.',
    },
    {
      q: 'How many schools or users can we add?',
      a: 'Both plans support unlimited student, parent, teacher, and staff accounts. There are no per-seat fees.',
    },
  ];

  toggleFaq(index: number): void {
    this.activeFaq.update((v) => (v === index ? null : index));
  }
}
