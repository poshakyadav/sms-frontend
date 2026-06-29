// no-credits-banner.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-credits-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="no-credits-banner" role="alert">
      <div class="no-credits-banner__icon">
        <i class="ti ti-alert-circle" aria-hidden="true"></i>
      </div>
      <div class="no-credits-banner__body">
        <p class="no-credits-banner__title">No WhatsApp credits remaining</p>
        <p class="no-credits-banner__desc">
          Purchase a message bundle to send WhatsApp notifications to parents and students.
        </p>
      </div>
      <a routerLink="/school/billing/bundles" class="no-credits-banner__cta">
        Buy credits
        <i class="ti ti-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  `,
  styles: [
    `
      .no-credits-banner {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 20px;
        background: #fff3e0;
        border: 1px solid #ffcc80;
        border-radius: 10px;
        margin-bottom: 20px;

        &__icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #ffe0b2;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e65100;
          font-size: 20px;
        }

        &__body {
          flex: 1;
          min-width: 0;
        }

        &__title {
          font-weight: 600;
          color: #bf360c;
          margin: 0 0 4px;
          font-size: 14px;
        }

        &__desc {
          color: #e64a19;
          font-size: 13px;
          margin: 0;
          line-height: 1.5;
        }

        &__cta {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #e65100;
          color: white;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s;

          &:hover {
            background: #bf360c;
          }

          .ti {
            font-size: 14px;
          }
        }
      }
    `,
  ],
})
export class NoCreditsBanner {}
