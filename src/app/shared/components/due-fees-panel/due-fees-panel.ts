// shared/components/due-fees-panel/due-fees-panel.ts
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FeesService, DueFeesResponse, DueFeeItem } from '../../../core/services/fees.service';
import { FeeStatusBadge } from '../fee-status-badge/fee-status-badge';
import { PaisePipe } from '../../pipes/paise-pipe';

@Component({
  selector: 'app-due-fees-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PaisePipe,
    FeeStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './due-fees-panel.html',
  styleUrl: './due-fees-panel.scss',
})
export class DueFeesPanel implements OnChanges {
  @Input({ required: true }) enrollmentId!: number;
  @Input() showPayButton = true;

  /** Emits when user clicks "Pay Now" — parent opens the record-payment modal */
  @Output() payNow = new EventEmitter<{ enrollmentId: number; dueFees: DueFeesResponse }>();

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<DueFeesResponse | null>(null);

  structuresExpanded = signal(true);
  assignmentsExpanded = signal(true);

  constructor(private fees: FeesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['enrollmentId'] && this.enrollmentId) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getDueFeesForEnrollment(this.enrollmentId).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load due fees');
        this.loading.set(false);
      },
    });
  }

  onPayNow(): void {
    const d = this.data();
    if (d) this.payNow.emit({ enrollmentId: this.enrollmentId, dueFees: d });
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  statusOf(item: DueFeeItem): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' {
    if (item.remaining <= 0) return 'PAID';
    if (item.paid > 0) return 'PARTIAL';
    if (item.dueDate && item.dueDate < new Date().toISOString().split('T')[0]) return 'OVERDUE';
    return 'PENDING';
  }

  trackById(_: number, item: DueFeeItem): number {
    return item.id;
  }
}