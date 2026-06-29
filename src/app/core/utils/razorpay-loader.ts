// src/app/core/utils/razorpay-loader.ts
//
// Loads the Razorpay Checkout.js script lazily on first use.
// Using a singleton promise ensures the script is loaded only once
// regardless of how many components call loadRazorpay() concurrently.
//
// Razorpay MUST be loaded from their CDN — never bundle it locally,
// as they update it for PCI-DSS compliance, fraud detection, and
// new payment methods without notice.

import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-js';

let scriptLoadPromise: Promise<void> | null = null;

/**
 * Injects the Razorpay Checkout.js script into the document <head> if it
 * hasn't already been loaded, then resolves when window.Razorpay is ready.
 *
 * Usage (inside a component/service):
 *   import { loadRazorpayScript } from '@core/utils/razorpay-loader';
 *   await loadRazorpayScript();
 *   const rzp = new window.Razorpay(options);
 */
export function loadRazorpayScript(): Promise<void> {
  // SSR guard — Razorpay is browser-only
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay is not available in SSR context'));
  }

  // Already loaded in a previous call this session
  if (window.Razorpay) {
    return Promise.resolve();
  }

  // Script tag already in DOM (e.g. added manually to index.html) but
  // window.Razorpay not yet available — wait for it
  const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID);
  if (existingScript && !scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () =>
        reject(new Error('Failed to load Razorpay Checkout script'))
      );
    });
  }

  // First caller — create the script tag and start loading
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = RAZORPAY_SCRIPT_ID;
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (window.Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay script loaded but window.Razorpay is not defined'));
        }
      };

      script.onerror = () => {
        // Reset so subsequent calls can retry
        scriptLoadPromise = null;
        const existing = document.getElementById(RAZORPAY_SCRIPT_ID);
        existing?.remove();
        reject(
          new Error('Failed to load Razorpay Checkout script. Check your internet connection.')
        );
      };

      document.head.appendChild(script);
    });
  }

  return scriptLoadPromise;
}

/**
 * Cleans up the cached promise (useful in tests or after a network error).
 */
export function resetRazorpayLoader(): void {
  scriptLoadPromise = null;
}
