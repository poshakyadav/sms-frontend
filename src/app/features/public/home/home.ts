// home.ts

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

interface FeatureCard {
  readonly icon: 'fees' | 'attendance' | 'exams' | 'people' | 'idcard' | 'message';
  readonly title: string;
  readonly description: string;
}

interface HomeStep {
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly mobileMenuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected readonly features: readonly FeatureCard[] = [
    {
      icon: 'fees',
      title: 'Fees & Payments',
      description:
        'Structured fee plans, concessions and online collection through Razorpay — one ledger per student, not a shared spreadsheet.',
    },
    {
      icon: 'attendance',
      title: 'Attendance',
      description:
        'Mark attendance by class and section in seconds, with a running record parents can actually see the same day.',
    },
    {
      icon: 'exams',
      title: 'Exams & Report Cards',
      description:
        'Set up exams, enter marks, and generate report cards without re-typing anything into Excel afterwards.',
    },
    {
      icon: 'people',
      title: 'Students & Parents',
      description:
        'One record per student — guardians, contact details and history — visible to the right people, and no one else.',
    },
    {
      icon: 'idcard',
      title: 'ID Cards',
      description:
        'Design a template once, print in bulk, and let anyone verify a card instantly by scanning its QR code.',
    },
    {
      icon: 'message',
      title: 'WhatsApp Updates',
      description:
        'Fee reminders, attendance alerts and announcements sent where parents already read their messages.',
    },
  ];

  protected readonly steps: readonly HomeStep[] = [
    {
      title: 'Set up your school',
      description:
        'Add classes, sections and students — or import an existing spreadsheet instead of typing everything again.',
    },
    {
      title: 'Bring your staff and parents in',
      description:
        'Assign roles and permissions, then invite teachers and parents over WhatsApp or email.',
    },
    {
      title: 'Go live',
      description:
        'Start collecting fees, marking attendance and sending updates the same day — no training manual required.',
    },
  ];

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    inject(SeoService).set(
      'Eduxo — School Management Software for Indian Schools',
      'Fees, attendance, exams, ID cards and WhatsApp updates for your school — one place built around how Indian schools actually run.',
    );

    // Runs once in the browser only — safe under SSR/prerendering,
    // no manual `typeof window` guard needed.
    afterNextRender(() => this.observeReveals());
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  private observeReveals(): void {
    const elements = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-reveal]');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    elements.forEach((el) => observer.observe(el));
  }
}