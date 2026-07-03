// src/app/core/services/message-bundles.service.ts

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export type MessageChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';

export interface MessageBundle {
  id: number;
  channel: MessageChannel;
  name: string;
  messageCount: number;
  amountPaise: number;
  discountPaise: number;
  finalAmountPaise: number;
  validityDays: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBundlePayload {
  channel: MessageChannel;
  name: string;
  messageCount: number;
  amountPaise: number;
  discountPaise?: number;
  validityDays?: number;
  sortOrder?: number;
}

export interface UpdateBundlePayload {
  name?: string;
  messageCount?: number;
  amountPaise?: number;
  discountPaise?: number;
  validityDays?: number;
  sortOrder?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MessageBundlesService {
  private api = inject(ApiService);

  list(channel?: MessageChannel): Observable<{ success: boolean; bundles: MessageBundle[] }> {
    let params = new HttpParams();
    if (channel) params = params.set('channel', channel);
    return this.api.get<{ success: boolean; bundles: MessageBundle[] }>(
      'super/message-bundles',
      params
    );
  }

  getOne(id: number): Observable<{ success: boolean; bundle: MessageBundle }> {
    return this.api.get<{ success: boolean; bundle: MessageBundle }>(
      `super/message-bundles/${id}`
    );
  }

  create(
    data: CreateBundlePayload
  ): Observable<{ success: boolean; message: string; bundle: MessageBundle }> {
    return this.api.post<{ success: boolean; message: string; bundle: MessageBundle }>(
      'super/message-bundles',
      data
    );
  }

  update(
    id: number,
    data: UpdateBundlePayload
  ): Observable<{ success: boolean; message: string; bundle: MessageBundle }> {
    return this.api.put<{ success: boolean; message: string; bundle: MessageBundle }>(
      `super/message-bundles/${id}`,
      data
    );
  }

  /** Backend soft-deletes (isActive = false) — there is no hard delete. */
  deactivate(id: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(
      `super/message-bundles/${id}`
    );
  }
}