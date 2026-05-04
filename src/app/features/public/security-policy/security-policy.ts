// security-policy.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface TocSection {
  id: string;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-security-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './security-policy.html',
  styleUrls: ['./security-policy.scss'],
})
export class SecurityPolicy implements OnInit, OnDestroy {
  lastUpdated = 'April 2026';
  activeSection = 'overview';

  private observer: IntersectionObserver | null = null;

  sections: TocSection[] = [
    { id: 'overview', title: 'Security Overview', icon: '🛡️' },
    { id: 'architecture', title: 'Architecture & Isolation', icon: '🏗️' },
    { id: 'data-protection', title: 'Data Protection', icon: '🔒' },
    { id: 'auth', title: 'Authentication & Access', icon: '🔑' },
    { id: 'network', title: 'Network Security', icon: '🌐' },
    { id: 'application', title: 'Application Security', icon: '💻' },
    { id: 'incident', title: 'Incident Response', icon: '🚨' },
    { id: 'disclosure', title: 'Responsible Disclosure', icon: '📢' },
    { id: 'compliance', title: 'Compliance', icon: '📋' },
    { id: 'responsibilities', title: 'School Responsibilities', icon: '🏫' },
    { id: 'contact', title: 'Security Contact', icon: '📬' },
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
