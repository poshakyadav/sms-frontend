// src/app/core/adapters/indian-date-adapter.ts
//
// Provides DD/MM/YYYY display format for Angular Material datepickers,
// while keeping the internal representation as a native JS Date object.
// The backend continues to receive yyyy-MM-dd via DatePipe in components.
//
// Usage — add to the `providers` array of any standalone component:
//
//   import { INDIAN_DATE_PROVIDERS } from 'src/app/core/adapters/indian-date-adapter';
//   providers: [DatePipe, ...INDIAN_DATE_PROVIDERS]
//
// No extra npm packages required — uses MatNativeDateModule only.

import { NativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { Injectable } from '@angular/core';

// ── 1. Display / parse format tokens ──────────────────────────────────────────

export const INDIAN_DATE_FORMATS = {
  parse: {
    // Angular Material will try to parse typed text using this format.
    // 'P' is the locale-aware short date. We override display separately.
    dateInput: 'dd/MM/yyyy',
  },
  display: {
    dateInput: 'dd/MM/yyyy', // shown inside the input
    monthYearLabel: 'MMM yyyy', // shown in the calendar header
    dateA11yLabel: 'dd MMMM yyyy', // screen reader
    monthYearA11yLabel: 'MMMM yyyy', // screen reader
  },
};

// ── 2. Custom adapter — overrides parse() and format() ────────────────────────

@Injectable()
export class IndianDateAdapter extends NativeDateAdapter {
  /**
   * Parse a string entered by the user.
   * Accepts:  DD/MM/YYYY  or  DD-MM-YYYY  or  DDMMYYYY
   * Falls back to the default parser for anything else.
   */
  // override parse(value: string | number): Date | null {
  //   if (typeof value === 'number') {
  //     return new Date(value);
  //   }

  //   if (!value || !value.trim()) {
  //     return null;
  //   }

  //   // Normalize separators: accept '/', '-', '.'
  //   const normalized = value.trim().replace(/[-.\s]/g, '/');
  //   const parts = normalized.split('/');

  //   if (parts.length === 3) {
  //     const day = parseInt(parts[0], 10);
  //     const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  //     const year = parseInt(parts[2], 10);

  //     if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
  //       // Handle 2-digit years: 25 → 2025
  //       const fullYear = year < 100 ? 2000 + year : year;
  //       const date = new Date(fullYear, month, day);
  //       // Validate: ensure the parsed components round-trip correctly
  //       if (
  //         date.getFullYear() === fullYear &&
  //         date.getMonth() === month &&
  //         date.getDate() === day
  //       ) {
  //         return date;
  //       }
  //     }
  //   }

  //   // Fallback: let the browser try (handles ISO strings from patchValue)
  //   const fallback = new Date(value);
  //   return isNaN(fallback.getTime()) ? null : fallback;
  // }

  override parse(value: string | number): Date | null {
    if (typeof value === 'number') {
      return new Date(value);
    }
  
    if (!value || !value.trim()) {
      return null;
    }
  
    const trimmed = value.trim();
  
    // ── Handle ISO format from backend: yyyy-MM-dd ─────────────────────────
    // Must be checked BEFORE the generic separator-split below, because
    // "2026-04-15".split('/') gives 1 part and falls to the browser fallback
    // which interprets it as UTC midnight → wrong local date in some timezones.
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year  = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1; // 0-indexed
      const day   = parseInt(isoMatch[3], 10);
      return new Date(year, month, day);   // local midnight — no UTC shift
    }
  
    // ── Handle DD/MM/YYYY typed by the user ───────────────────────────────
    // Normalize separators: accept '/', '-', '.'
    const normalized = trimmed.replace(/[-.\s]/g, '/');
    const parts = normalized.split('/');
  
    if (parts.length === 3) {
      const day   = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year  = parseInt(parts[2], 10);
  
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const fullYear = year < 100 ? 2000 + year : year;
        const date = new Date(fullYear, month, day);
  
        if (
          date.getFullYear() === fullYear &&
          date.getMonth()    === month    &&
          date.getDate()     === day
        ) {
          return date;
        }
      }
    }
  
    // ── Last resort fallback (e.g. full ISO datetime strings) ─────────────
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  /**
   * Format a Date for display inside the input.
   * Returns DD/MM/YYYY.
   */
  override format(date: Date, displayFormat: string): string {
    if (displayFormat === 'dd/MM/yyyy') {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }

    // For calendar header labels (MMM yyyy, MMMM yyyy) use the built-in formatter
    return super.format(date, displayFormat);
  }
}

// ── 3. Convenience provider array — spread this into component providers ──────

export const INDIAN_DATE_PROVIDERS = [
  { provide: MAT_DATE_LOCALE, useValue: 'en-IN' },
  { provide: DateAdapter, useClass: IndianDateAdapter, deps: [MAT_DATE_LOCALE] },
  { provide: MAT_DATE_FORMATS, useValue: INDIAN_DATE_FORMATS },
];
