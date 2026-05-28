// features/school/fees/fee-concessions/concessions-list/concessions-list.ts
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeesService, FeeConcession } from '../../../../../core/services/fees.service';
import { PaisePipe } from '../../../../../shared/pipes/paise-pipe';

@Component({
  selector: 'app-concessions-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    PaisePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cl-wrap">
      <!-- Header -->
      <div class="cl-header">
        <div class="cl-header__left">
          <mat-icon class="cl-header__icon">local_offer</mat-icon>
          <div>
            <h3 class="cl-header__title">Concessions</h3>
            @if (!loading() && concessions().length > 0) {
            <p class="cl-header__sub">
              {{ concessions().length }} record{{ concessions().length !== 1 ? 's' : '' }}
            </p>
            }
          </div>
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
      <div class="cl-state">
        <mat-spinner diameter="28" />
        <span>Loading concessions…</span>
      </div>
      }

      <!-- Error -->
      @if (error()) {
      <div class="cl-state cl-state--error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error() }}</span>
        <button mat-stroked-button (click)="load()">Retry</button>
      </div>
      }

      <!-- Empty -->
      @if (!loading() && !error() && concessions().length === 0) {
      <div class="cl-state cl-state--empty">
        <mat-icon>local_offer</mat-icon>
        <p>No concessions granted</p>
      </div>
      }

      <!-- Table -->
      @if (!loading() && !error() && concessions().length > 0) {
      <div class="cl-table-wrap">
        <table class="cl-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Fee Type</th>
              <th>Month</th>
              <th class="text-right">Original</th>
              <th>Concession</th>
              <th class="text-right">Discount</th>
              <th class="text-right">Effective</th>
              <th>Reason</th>
              <th class="text-center">Status</th>
              @if (canRevoke) {
              <th class="text-center">Action</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (c of concessions(); track c.id) {
            <tr class="cl-row" [class.cl-row--revoked]="!c.isActive">
              <td>
                <span
                  class="source-badge"
                  [class.source-badge--structure]="c.source === 'STRUCTURE'"
                  [class.source-badge--assignment]="c.source === 'ASSIGNMENT'"
                >
                  <mat-icon>{{
                    c.source === 'STRUCTURE' ? 'receipt_long' : 'directions_bus'
                  }}</mat-icon>
                  {{ c.source === 'STRUCTURE' ? 'Standard' : 'Custom' }}
                </span>
              </td>
              <td>
                <span class="fee-chip">{{ c.feeType }}</span>
              </td>
              <td class="cell-muted">{{ formatMonth(c.feeMonth) }}</td>
              <td class="text-right amount-cell">{{ c.originalAmount | paise : 'compact' }}</td>
              <td>
                <span class="concession-type-chip">
                  {{
                    c.concessionType === 'PERCENTAGE'
                      ? c.concessionValue + '%'
                      : (c.concessionValue | paise : 'compact')
                  }}
                </span>
              </td>
              <td class="text-right amount-cell text-error">
                -{{ c.discountAmount | paise : 'compact' }}
              </td>
              <td class="text-right amount-cell text-success">
                {{ c.effectiveAmount | paise : 'compact' }}
              </td>
              <td class="reason-cell cell-muted" [matTooltip]="c.reason">{{ c.reason }}</td>
              <td class="text-center">
                @if (c.isActive) {
                <span class="status-badge status-badge--active">Active</span>
                } @else {
                <span class="status-badge status-badge--revoked">Revoked</span>
                }
              </td>
              @if (canRevoke) {
              <td class="text-center">
                @if (c.isActive) {
                <button
                  mat-icon-button
                  class="revoke-btn"
                  matTooltip="Revoke Concession"
                  [disabled]="revoking() === c.id"
                  (click)="onRevoke(c)"
                >
                  @if (revoking() === c.id) {
                  <mat-spinner diameter="14" />
                  } @else {
                  <mat-icon>block</mat-icon>
                  }
                </button>
                }
              </td>
              }
            </tr>
            }
          </tbody>
        </table>
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cl-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-divider);
        background: color-mix(in srgb, var(--color-success) 4%, var(--color-bg-card));

        &__left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        &__icon {
          font-size: 18px;
          height: 18px;
          width: 18px;
          color: var(--color-success);
        }

        &__title {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        &__sub {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          margin: 0;
        }
      }

      .cl-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 32px 16px;
        color: var(--color-text-muted);
        font-size: 0.875rem;

        mat-icon {
          font-size: 28px;
          height: 28px;
          width: 28px;
          opacity: 0.35;
        }
        p {
          margin: 0;
        }

        &--error {
          color: var(--color-error);
          mat-icon {
            opacity: 1;
          }
        }
        &--empty mat-icon {
          color: var(--color-success);
        }
      }

      .cl-table-wrap {
        overflow-x: auto;
      }

      .cl-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        min-width: 700px;

        thead tr {
          background: color-mix(in srgb, var(--color-hover) 60%, transparent);
          border-bottom: 1px solid var(--color-divider);
        }

        th {
          padding: 7px 12px;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          text-align: left;
          white-space: nowrap;
        }

        td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--color-divider);
          vertical-align: middle;
          color: var(--color-text-primary);
        }
      }

      .cl-row {
        transition: background 0.12s;

        &:hover {
          background: var(--color-hover);
        }
        &:last-child td {
          border-bottom: none;
        }

        &--revoked {
          opacity: 0.55;
        }
      }

      .text-right {
        text-align: right;
      }
      .text-center {
        text-align: center;
      }
      .text-success {
        color: var(--color-success);
      }
      .text-error {
        color: var(--color-error);
      }
      .cell-muted {
        color: var(--color-text-muted);
      }
      .amount-cell {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .source-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;

        mat-icon {
          font-size: 11px;
          height: 11px;
          width: 11px;
        }

        &--structure {
          background: color-mix(in srgb, var(--color-primary) 10%, transparent);
          color: var(--color-primary);
        }
        &--assignment {
          background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
          color: var(--color-secondary);
        }
      }

      .fee-chip {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--color-info) 10%, transparent);
        color: var(--color-info);
      }

      .concession-type-chip {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--color-success) 10%, transparent);
        color: color-mix(in srgb, var(--color-success) 70%, #000);
      }

      .status-badge {
        display: inline-block;
        font-size: 0.65rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 9999px;

        &--active {
          background: color-mix(in srgb, var(--color-success) 12%, transparent);
          color: color-mix(in srgb, var(--color-success) 70%, #000);
        }
        &--revoked {
          background: var(--color-hover);
          color: var(--color-text-muted);
        }
      }

      .reason-cell {
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.78rem;
        cursor: default;
      }

      .revoke-btn {
        color: var(--color-error) !important;
        width: 28px !important;
        height: 28px !important;

        mat-icon {
          font-size: 14px;
          height: 14px;
          width: 14px;
        }

        &:hover {
          background: color-mix(in srgb, var(--color-error) 10%, transparent) !important;
        }
      }
    `,
  ],
})
export class ConcessionsList implements OnChanges {
  @Input({ required: true }) enrollmentId!: number;
  @Input() canRevoke = false;

  @Output() revoked = new EventEmitter<void>();

  loading = signal(false);
  error = signal<string | null>(null);
  concessions = signal<FeeConcession[]>([]);
  revoking = signal<number | null>(null);

  constructor(private fees: FeesService, private snack: MatSnackBar) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['enrollmentId'] && this.enrollmentId) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fees.getConcessionsForEnrollment(this.enrollmentId).subscribe({
      next: (list) => {
        this.concessions.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load concessions');
        this.loading.set(false);
      },
    });
  }

  onRevoke(concession: FeeConcession): void {
    if (!confirm(`Revoke concession for ${concession.feeType}? This cannot be undone.`)) return;

    this.revoking.set(concession.id);
    this.fees.revokeConcession(concession.id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.snack.open('Concession revoked', 'Close', { duration: 3000 });
        this.load();
        this.revoked.emit();
      },
      error: (err) => {
        this.revoking.set(null);
        this.snack.open(err?.error?.error ?? 'Failed to revoke concession', 'Close', {
          duration: 4000,
          panelClass: 'error-toast',
        });
      },
    });
  }

  formatMonth(feeMonth: string | null): string {
    if (!feeMonth) return '—';
    const [y, m] = feeMonth.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[parseInt(m) - 1]} ${y}`;
  }
}
