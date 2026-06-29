// src/app/features/school/school-payment-status/school-payment-status.ts
//
// /school/payment-status?code=<schoolCode>
// Activation polling page — shown after payment is verified.
// Auto-polls GET /school/auth/payment-status/:schoolCode every 30 seconds.
// When isActive === true, shows success state with "Go to Login" button.

import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentStatusResponse {
  success: boolean;
  school: {
    name: string;
    onboardingStatus: string;
    isActive: boolean;
  };
  paymentRecord: {
    status: string;
    submittedAt?: string;
    verifiedAt?: string;
  } | null;
  razorpayPayments: Array<{
    id: number;
    paymentType: string;
    status: string;
    amountPaise: number;
    capturedAt?: string;
    createdAt: string;
  }>;
}

type PageState = 'loading' | 'polling' | 'activated' | 'error';

@Component({
  selector: 'app-school-payment-status',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './school-payment-status.html',
  styleUrl: './school-payment-status.scss',
})
export class SchoolPaymentStatus implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  // ── State ────────────────────────────────────────────────────────────────────
  pageState = signal<PageState>('loading');
  errorMessage = signal('');
  schoolCode = signal<string | null>(null);
  schoolName = signal('');
  onboardingStatus = signal('');
  submissionTimestamp = signal<string | null>(null);
  isPolling = signal(false);
  lastCheckedAt = signal<Date | null>(null);

  // Razorpay payment captured timestamp (from razorpayPayments)
  paymentCapturedAt = signal<string | null>(null);

  private pollingInterval: any = null;
  private readonly POLL_INTERVAL_MS = 30_000;

  // ── Derived ──────────────────────────────────────────────────────────────────

  /** Which timeline step is current */
  currentStep = computed(() => {
    const status = this.onboardingStatus();
    if (status === 'ACTIVE') return 3;
    if (status === 'PAYMENT_SUBMITTED') return 2;
    if (status === 'REGISTERED') return 1;
    return 1;
  });

  formattedLastChecked = computed(() => {
    const d = this.lastCheckedAt();
    if (!d) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code) {
      this.pageState.set('error');
      this.errorMessage.set(
        'No school code provided. Please use the link from your payment confirmation email.'
      );
      return;
    }

    this.schoolCode.set(code.toUpperCase());

    // Check if coming from activation confirmation param
    const activated = this.route.snapshot.queryParamMap.get('activated');
    if (activated === 'true') {
      this.pageState.set('activated');
    }

    this.fetchStatus(true);
  }

  ngOnDestroy(): void {
    this.clearPolling();
  }

  // ── Status fetch ─────────────────────────────────────────────────────────────

  private fetchStatus(initial = false): void {
    const code = this.schoolCode();
    if (!code) return;

    if (!initial) {
      this.isPolling.set(true);
    }

    this.http
      .get<PaymentStatusResponse>(`${environment.apiUrl}/school/auth/payment-status/${code}`)
      .subscribe({
        next: (res) => {
          this.isPolling.set(false);
          this.lastCheckedAt.set(new Date());

          if (!res.success) {
            this.pageState.set('error');
            this.errorMessage.set('School not found. Please check the link in your email.');
            this.clearPolling();
            return;
          }

          this.schoolName.set(res.school?.name ?? '');
          this.onboardingStatus.set(res.school?.onboardingStatus ?? '');

          // Find submission timestamp from Razorpay payments
          if (res.razorpayPayments?.length) {
            const captured = res.razorpayPayments.find((p) => p.status === 'CAPTURED');
            if (captured?.capturedAt) {
              this.paymentCapturedAt.set(captured.capturedAt);
            } else if (res.razorpayPayments[0]?.createdAt) {
              this.submissionTimestamp.set(res.razorpayPayments[0].createdAt);
            }
          }

          // Check activation
          if (res.school?.isActive) {
            this.pageState.set('activated');
            this.clearPolling();
            return;
          }

          // Not yet active — show polling UI
          if (initial) {
            this.pageState.set('polling');
            this.startPolling();
          }
        },
        error: (err) => {
          this.isPolling.set(false);
          this.lastCheckedAt.set(new Date());

          if (initial) {
            this.pageState.set('error');
            this.errorMessage.set(
              err?.error?.error || 'Failed to load status. Please refresh the page.'
            );
          }
          // On subsequent polls, silently retry — don't break the page
        },
      });
  }

  private startPolling(): void {
    this.clearPolling();
    this.pollingInterval = setInterval(() => {
      this.fetchStatus(false);
    }, this.POLL_INTERVAL_MS);
  }

  private clearPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // ── Public actions ───────────────────────────────────────────────────────────

  checkNow(): void {
    if (this.isPolling()) return;
    this.fetchStatus(false);
  }

  copySchoolCode(): void {
    const code = this.schoolCode();
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  formatTimestamp(ts: string | null): string {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
