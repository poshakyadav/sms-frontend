import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { FeesService, PaymentHistory } from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-payments-history',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './payments-history.html',
  styleUrl: './payments-history.scss',
})
export class PaymentsHistory implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private feesService = inject(FeesService);
  private toast = inject(ToastService);

  enrollmentId = signal<number>(0);
  history = signal<PaymentHistory[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  displayedColumns = ['date', 'feeType', 'amount', 'method', 'receipt', 'notes'];

  totalPaid = computed(() => this.history().reduce((sum, p) => sum + p.amountPaid, 0));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('enrollmentId');
    if (!id || isNaN(+id)) {
      this.error.set('Invalid enrollment ID');
      this.loading.set(false);
      return;
    }
    this.enrollmentId.set(+id);
    this.loadHistory();
  }

  loadHistory() {
    this.loading.set(true);
    this.error.set(null);

    this.feesService.getPaymentsForEnrollment(this.enrollmentId()).subscribe({
      next: (res) => {
        this.history.set(res.history ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load payment history');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  goBack() {
    this.router.navigate(['/school/fees/payments/record']);
  }
}
