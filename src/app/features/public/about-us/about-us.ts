// about-us.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface TeamValue {
  icon: string;
  title: string;
  description: string;
}

interface Stat {
  value: string;
  label: string;
  suffix?: string;
}

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about-us.html',
  styleUrls: ['./about-us.scss'],
})
export class AboutUs {
  year = new Date().getFullYear();

  // ── Key platform capabilities shown as stats ────────────────────────────
  // NOTE: These are platform capability/design specs, not live operational
  // metrics. Do not replace with inflated or unverified user numbers.
  stats: Stat[] = [
    { value: '10+', label: 'Core Modules', suffix: '' },
    { value: '99.9', label: 'Uptime Target', suffix: '%' },
    { value: 'DPDP', label: 'Act 2023 Aligned', suffix: '' },
    { value: '₹5,000', label: 'One-Time Setup Fee', suffix: '' },
  ];

  values: TeamValue[] = [
    {
      icon: '🛡️',
      title: 'Privacy First',
      description:
        'Student data is sacred. We design every feature with privacy at its core — no data selling, no behavioural profiling, no exceptions.',
    },
    {
      icon: '🚀',
      title: 'Built for India',
      description:
        'Designed specifically for Indian schools — local payment flows, CBSE / ICSE / State board alignment, and DPDP Act 2023 compliance.',
    },
    {
      icon: '🤝',
      title: 'School-Centric',
      description:
        'We build what schools ask for. Our roadmap is driven by real feedback from principals, teachers, and administrators.',
    },
    {
      icon: '🔒',
      title: 'Strong Isolation',
      description:
        "Each school gets its own isolated data store. Your data never mingles with another school's data — by architectural design.",
    },
    {
      icon: '⚡',
      title: 'Fast & Reliable',
      description:
        'Built on globally distributed, enterprise-grade infrastructure. Pages load quickly — even in Tier-2 and Tier-3 cities across India.',
    },
    {
      icon: '💡',
      title: 'Honest Pricing',
      description:
        'One transparent one-time setup fee, then a simple Monthly or Yearly subscription. No ads, no data selling, no per-user traps, no surprise renewals.',
    },
  ];
}