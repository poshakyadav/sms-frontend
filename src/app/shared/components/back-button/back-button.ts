// src/app/shared/components/back-button/back-button.component.ts
//
// Shared back-navigation button.
//
// Usage:
//   <app-back-button />                              — uses browser history
//   <app-back-button fallbackUrl="/school/dashboard" />  — fallback if no history
//   <app-back-button label="Return to Years" />      — custom label
//   <app-back-button variant="icon" />      — only icon variant
//
// How it works:
//   Location.back() pops the browser history stack (like the browser back button).
//   If the user arrived directly (history.length <= 1, e.g. bookmarked URL or
//   new tab), we fall back to the provided fallbackUrl so they're never stranded.

/**
 * 
 * <!-- In the template — three variants: -->

<!-- academics-year-form header — icon + "Back" (default) -->
<app-back-button fallbackUrl="/school/academics/years" />

<!-- Custom label -->
<app-back-button label="Return to Years" fallbackUrl="/school/academics/years" />

<!-- bulk-student-upload dense header — icon only, tooltip says "Back to Students" -->
<app-back-button
  variant="icon"
  label="Back to Students"
  fallbackUrl="/school/students"
/>

 */

import { Component, input, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './back-button.html',
  styleUrl: './back-button.scss',
})
export class BackButtonComponent {
  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Text label shown next to the arrow icon (only used when variant = 'text'). */
  readonly label = input<string>('Back');

  /**
   * 'text'     — icon + label (default, used in form page headers)
   * 'icon'     — icon only, circular; label shown as tooltip (used in dense headers)
   */
  readonly variant = input<'text' | 'icon'>('text');

  /**
   * Fallback route if there is no browser history to go back to.
   * Defaults to '/' — always override this per usage site.
   */
  readonly fallbackUrl = input<string>('/');

  // ── DI ─────────────────────────────────────────────────────────────────────

  private readonly location = inject(Location);
  private readonly router = inject(Router);

  // ── Handler ────────────────────────────────────────────────────────────────

  navigate(): void {
    // history.length is 1 when this is the first (or only) page in the tab —
    // i.e. the user arrived directly via a bookmarked/shared URL.
    // In that case, go to the fallback rather than leaving the app entirely.
    if (history.length > 1) {
      this.location.back();
    } else {
      this.router.navigateByUrl(this.fallbackUrl());
    }
  }
}
