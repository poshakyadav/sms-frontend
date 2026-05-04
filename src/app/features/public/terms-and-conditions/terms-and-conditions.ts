// terms-and-conditions.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface TocSection {
  id: string;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-terms-and-conditions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './terms-and-conditions.html',
  styleUrls: ['./terms-and-conditions.scss'],
})
export class TermsAndConditions implements OnInit, OnDestroy {
  lastUpdated = 'April 24, 2026';
  effectiveDate = 'April 24, 2026';
  activeSection = 'acceptance';

  private observer: IntersectionObserver | null = null;

  sections: TocSection[] = [
    { id: 'acceptance', title: 'Acceptance of Terms', icon: '✅' },
    { id: 'definitions', title: 'Definitions', icon: '📖' },
    { id: 'eligibility', title: 'Eligibility & Registration', icon: '🏫' },
    { id: 'access', title: 'Access & Account Security', icon: '🔐' },
    { id: 'permitted-use', title: 'Permitted Use', icon: '✔️' },
    { id: 'prohibited', title: 'Prohibited Conduct', icon: '🚫' },
    { id: 'data', title: 'Data & Privacy', icon: '🛡️' },
    { id: 'advertising', title: 'Advertising & Premium', icon: '📢' },
    { id: 'payment', title: 'Payment & Fees', icon: '💳' },
    { id: 'ip', title: 'Intellectual Property', icon: '©️' },
    { id: 'liability', title: 'Limitation of Liability', icon: '⚖️' },
    { id: 'termination', title: 'Termination', icon: '🔚' },
    { id: 'governing', title: 'Governing Law', icon: '🏛️' },
    { id: 'contact', title: 'Contact Us', icon: '📬' },
  ];

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.activeSection = entry.target.id;
          }
        });
      },
      { rootMargin: '-20% 0px -75% 0px' }
    );

    setTimeout(() => {
      this.sections.forEach((sec) => {
        const el = document.getElementById(sec.id);
        if (el) this.observer?.observe(el);
      });
    }, 100);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSection = id;
  }
}