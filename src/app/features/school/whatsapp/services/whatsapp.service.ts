// src/app/features/school/whatsapp/services/whatsapp.service.ts

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import {
  Observable,
  tap,
  throwError,
  catchError,
  interval,
  switchMap,
  takeWhile,
  take,
} from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import {
  WhatsappBalance,
  WhatsappMessage,
  WhatsappTemplate,
  TemplateDefinition,
  BulkSend,
  BulkSendStatus,
  WhatsappInboundMessage,
  SendSingleInput,
  BulkInitiateInput,
  BulkInitiateResult,
  SendMessageResult,
} from '../types/whatsapp.types';

export interface TemplatesResponse {
  success: boolean;
  templates: WhatsappTemplate[];
  definitions: TemplateDefinition[];
}

export interface MessageHistoryParams {
  limit?: number;
  offset?: number;
  status?: string;
  module?: string;
  bulkSendId?: number;
}

const TERMINAL_BULK_STATUSES: BulkSendStatus[] = ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'];
const POLL_INTERVAL_MS = 3000;

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private api = inject(ApiService);

  // ── Reactive state signals ────────────────────────────────────────────────

  balance = signal<WhatsappBalance | null>(null);
  templates = signal<WhatsappTemplate[]>([]);
  definitions = signal<TemplateDefinition[]>([]);
  messageHistory = signal<WhatsappMessage[]>([]);
  bulkSends = signal<BulkSend[]>([]);
  inboundMessages = signal<WhatsappInboundMessage[]>([]);

  isLoadingBalance = signal(false);
  isLoadingTemplates = signal(false);
  isLoadingHistory = signal(false);
  isSyncing = signal(false);
  isSending = signal(false);

  syncError = signal<string | null>(null);

  // ── Computed convenience signals ──────────────────────────────────────────

  creditsRemaining = computed(() => this.balance()?.creditsRemaining ?? 0);
  hasCredits = computed(() => this.creditsRemaining() > 0);
  isLowCredits = computed(() => {
    const c = this.creditsRemaining();
    return c > 0 && c < 20;
  });
  isCriticalCredits = computed(() => {
    const c = this.creditsRemaining();
    return c > 0 && c < 5;
  });
  approvedTemplates = computed(() => this.templates().filter((t) => t.status === 'APPROVED'));
  hasApprovedTemplates = computed(() => this.approvedTemplates().length > 0);
  templatesNeedSync = computed(() => !this.isLoadingTemplates() && this.templates().length === 0);

  // ── Balance ───────────────────────────────────────────────────────────────

  loadBalance(): Observable<any> {
    this.isLoadingBalance.set(true);
    return this.api.get<any>('school/whatsapp/balance').pipe(
      tap((res) => {
        if (res.success) {
          this.balance.set(res.balance);
        }
        this.isLoadingBalance.set(false);
      }),
      catchError((err) => {
        this.isLoadingBalance.set(false);
        return throwError(() => err);
      })
    );
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  loadTemplates(onlyApproved = false): Observable<TemplatesResponse> {
    this.isLoadingTemplates.set(true);
    let params = new HttpParams();
    if (onlyApproved) params = params.set('status', 'approved');

    return this.api.get<TemplatesResponse>('school/whatsapp/templates', params).pipe(
      tap((res) => {
        if (res.success) {
          this.templates.set(res.templates);
          this.definitions.set(res.definitions);
        }
        this.isLoadingTemplates.set(false);
      }),
      catchError((err) => {
        this.isLoadingTemplates.set(false);
        return throwError(() => err);
      })
    );
  }

  syncTemplates(): Observable<any> {
    this.isSyncing.set(true);
    this.syncError.set(null);
    return this.api.post<any>('school/whatsapp/templates/sync', {}).pipe(
      tap((res) => {
        this.isSyncing.set(false);
        if (res.success) {
          // Reload templates after sync
          this.loadTemplates().subscribe();
        }
      }),
      catchError((err) => {
        this.isSyncing.set(false);
        this.syncError.set(err?.error?.error || 'Sync failed. Please try again.');
        return throwError(() => err);
      })
    );
  }

  // ── Single send ───────────────────────────────────────────────────────────

  sendSingle(input: SendSingleInput): Observable<SendMessageResult> {
    this.isSending.set(true);
    return this.api.post<SendMessageResult>('school/whatsapp/send', input).pipe(
      tap((res) => {
        this.isSending.set(false);
        if (res.success) {
          // Decrement balance locally (optimistic update)
          const current = this.balance();
          if (current) {
            this.balance.set({
              ...current,
              creditsUsed: current.creditsUsed + 1,
              creditsRemaining: current.creditsRemaining - 1,
            });
          }
        }
      }),
      catchError((err) => {
        this.isSending.set(false);
        return throwError(() => err);
      })
    );
  }

  // ── Bulk send ─────────────────────────────────────────────────────────────

  initiateBulk(input: BulkInitiateInput): Observable<{ success: boolean } & BulkInitiateResult> {
    return this.api.post<{ success: boolean } & BulkInitiateResult>(
      'school/whatsapp/bulk/initiate',
      input
    );
  }

  startBulk(bulkSendId: number): Observable<any> {
    return this.api.post<any>(`school/whatsapp/bulk/${bulkSendId}/start`, {});
  }

  getBulkStatus(bulkSendId: number): Observable<{ success: boolean; bulkSend: BulkSend }> {
    return this.api.get<{ success: boolean; bulkSend: BulkSend }>(
      `school/whatsapp/bulk/${bulkSendId}/status`
    );
  }

  /**
   * Polls bulk send status every 3s until a terminal state is reached.
   * Returns an Observable that emits BulkSend on each poll and completes
   * automatically when status is COMPLETED, PARTIAL, FAILED, or CANCELLED.
   */
  pollBulkStatus(bulkSendId: number): Observable<BulkSend> {
    return interval(POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getBulkStatus(bulkSendId)),
      tap((res) => {
        if (res.success && res.bulkSend) {
          // Update balance after bulk completes
          if (TERMINAL_BULK_STATUSES.includes(res.bulkSend.status)) {
            this.loadBalance().subscribe();
          }
        }
      }),
      switchMap((res) => {
        if (res.success) return [res.bulkSend];
        return throwError(() => new Error('Failed to get bulk status'));
      }),
      takeWhile(
        (bulkSend) => !TERMINAL_BULK_STATUSES.includes(bulkSend.status),
        true // emit the terminal state once, then complete
      )
    );
  }

  loadBulkList(limit = 20, offset = 0): Observable<any> {
    const params = new HttpParams().set('limit', limit.toString()).set('offset', offset.toString());
    return this.api.get<any>('school/whatsapp/bulk', params).pipe(
      tap((res) => {
        if (res.success) this.bulkSends.set(res.bulkSends);
      })
    );
  }

  // ── Message history ───────────────────────────────────────────────────────

  loadMessageHistory(params: MessageHistoryParams = {}): Observable<any> {
    this.isLoadingHistory.set(true);
    let httpParams = new HttpParams()
      .set('limit', (params.limit ?? 20).toString())
      .set('offset', (params.offset ?? 0).toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.module) httpParams = httpParams.set('module', params.module);
    // ── NEW: scope history to one bulk send (used by whatsapp-bulk-detail) ──
    if (params.bulkSendId !== undefined) {
      httpParams = httpParams.set('bulkSendId', params.bulkSendId.toString());
    }

    return this.api.get<any>('school/whatsapp/messages', httpParams).pipe(
      tap((res) => {
        if (res.success) this.messageHistory.set(res.messages);
        this.isLoadingHistory.set(false);
      }),
      catchError((err) => {
        this.isLoadingHistory.set(false);
        return throwError(() => err);
      })
    );
  }

  // ── Inbound messages ──────────────────────────────────────────────────────

  loadInbound(limit = 20, offset = 0): Observable<any> {
    const params = new HttpParams().set('limit', limit.toString()).set('offset', offset.toString());
    return this.api.get<any>('school/whatsapp/inbound', params).pipe(
      tap((res) => {
        if (res.success) this.inboundMessages.set(res.messages);
      })
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Finds a TemplateDefinition by template key.
   * Used by components to get variable list and body text for preview.
   */
  getDefinitionByKey(key: string): TemplateDefinition | undefined {
    return this.definitions().find((d) => d.key === key);
  }

  /**
   * Interpolates template body text with variable values.
   * Replaces {{1}}, {{2}}, etc. in order using the variables array.
   * Unfilled slots show as {{variable_name}} for preview.
   */
  interpolateTemplate(
    bodyText: string,
    variables: string[],
    values: Record<string, string>
  ): string {
    let result = bodyText;
    variables.forEach((varName, idx) => {
      const placeholder = `{{${idx + 1}}}`;
      const value = values[varName];
      result = result.replace(
        placeholder,
        value !== undefined && value !== '' ? value : `{{${varName}}}`
      );
    });
    return result;
  }
}
