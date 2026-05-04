// privacy-policy.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface TocSection {
  id: string;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy-policy.html',
  styleUrls: ['./privacy-policy.scss'],
})
export class PrivacyPolicy implements OnInit, OnDestroy {
  lastUpdated = 'April 24, 2026';
  activeSection = 'overview';

  private observer: IntersectionObserver | null = null;

  sections: TocSection[] = [
    { id: 'overview', title: 'Overview', icon: '📋' },
    { id: 'controller', title: 'Data Controller', icon: '🏛️' },
    { id: 'what-we-collect', title: 'What We Collect', icon: '📂' },
    { id: 'how-we-use', title: 'How We Use Data', icon: '⚙️' },
    { id: 'legal-basis', title: 'Legal Basis', icon: '⚖️' },
    { id: 'sharing', title: 'Data Sharing', icon: '🤝' },
    { id: 'advertising', title: 'Advertising', icon: '📢' },
    { id: 'children', title: "Children's Privacy", icon: '🧒' },
    { id: 'retention', title: 'Retention & Deletion', icon: '🗂️' },
    { id: 'rights', title: 'Your Rights', icon: '✅' },
    { id: 'security', title: 'Security Measures', icon: '🔒' },
    { id: 'cookies', title: 'Cookies & Storage', icon: '🍪' },
    { id: 'changes', title: 'Policy Changes', icon: '📝' },
    { id: 'contact', title: 'Contact & Grievance', icon: '📬' },
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
