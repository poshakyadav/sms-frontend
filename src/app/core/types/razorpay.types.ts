// src/app/core/types/razorpay.types.ts
// Global type declarations for Razorpay Checkout.js

export interface RazorpayOptions {
  key: string;
  amount?: number; // in paise — for orders
  currency?: string;
  name: string;
  description?: string;
  image?: string;
  order_id?: string; // for manual Orders rail
  subscription_id?: string; // for Autopay rail (mutually exclusive with order_id)
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    hide_topbar?: boolean;
  };
  modal?: {
    ondismiss?: () => void;
    animation?: boolean;
    backdropclose?: boolean;
    escape?: boolean;
    handleback?: boolean;
  };
  readonly?: {
    name?: boolean;
    email?: boolean;
    contact?: boolean;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string; // present for order payments
  razorpay_subscription_id?: string; // present for subscription payments
  razorpay_signature: string;
}

export interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: string, callback: (response: any) => void): void;
}

// Augment the global Window type
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
