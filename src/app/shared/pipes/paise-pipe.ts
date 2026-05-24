// shared/pipes/paise.pipe.ts
// Pure pipe: converts paise (integer) → formatted ₹ string.
// Usage: {{ 150000 | paise }}         → "₹1,500.00"
//        {{ 150000 | paise:'compact' }} → "₹1,500"
//        {{ 150000 | paise:'short' }}   → "₹1.5K"

import { Pipe, PipeTransform } from '@angular/core';

export type PaiseFormat = 'default' | 'compact' | 'short';

@Pipe({ name: 'paise', standalone: true, pure: true })
export class PaisePipe implements PipeTransform {
  transform(paise: number | null | undefined, format: PaiseFormat = 'default'): string {
    if (paise === null || paise === undefined || isNaN(paise)) return '₹0';

    const rupees = paise / 100;

    if (format === 'short') {
      if (Math.abs(rupees) >= 100000) {
        return `₹${(rupees / 100000).toFixed(2)}L`;
      }
      if (Math.abs(rupees) >= 1000) {
        return `₹${(rupees / 1000).toFixed(1)}K`;
      }
      return `₹${rupees.toFixed(0)}`;
    }

    if (format === 'compact') {
      return `₹${rupees.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    }

    // default — two decimal places
    return `₹${rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
