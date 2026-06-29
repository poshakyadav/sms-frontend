// src/app/core/services/id-card.service.ts

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IdCardHolderType = 'STUDENT' | 'STAFF';
export type IdCardStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'REISSUED';

export interface IdCardLayoutConfig {
  accentColor: string;
  accentTextColor: string;
  backgroundColor: string;
  showLogo: boolean;
  showTagline: boolean;
  visibleFields: string[];
  footerNote: string;
  qrSizeRatio: number;
}

export interface IdCardTemplate {
  id: number;
  name: string;
  holderType: IdCardHolderType;
  layoutConfig: IdCardLayoutConfig;
  isDefault: boolean;
  isActive: boolean;
}

export interface IdCardDetailsSnapshot {
  className?: string;
  sectionName?: string;
  rollNumber?: string;
  admissionNumber?: string;
  designation?: string;
  department?: string;
  employeeCode?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
}

export interface IdCardSchoolInfo {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  tagline: string | null;
  addressLineOne: string;
  addressLineTwo: string;
  phone: string;
}

export interface IdCardData {
  id: number;
  cardNumber: string;
  holderType: IdCardHolderType;
  holderName: string;
  photoUrl: string | null;
  details: IdCardDetailsSnapshot;
  issuedAt: string;
  validUntil: string;
  status: IdCardStatus;
  verificationUrl: string;
  template: { id: number; name: string; layoutConfig: IdCardLayoutConfig };
  school: IdCardSchoolInfo;
}

export interface IdCardListItem {
  id: number;
  cardNumber: string;
  holderType: IdCardHolderType;
  holderName: string;
  photoUrl: string | null;
  status: IdCardStatus;
  issuedAt: string;
  validUntil: string;
}

export interface GenerateCardInput {
  holderUserId: number;
  templateId: number;
  validUntil: string;
  enrollmentId?: number;
}

export interface GenerateBulkInput {
  templateId: number;
  validUntil: string;
  holders: Array<{ holderUserId: number; enrollmentId?: number }>;
}

export interface GenerateBulkResult {
  generatedCount: number;
  failedCount: number;
  cardIds: number[];
  failures: Array<{ holderUserId: number; error: string }>;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class IdCardService {
  constructor(private api: ApiService) {}

  // ── Templates ─────────────────────────────────────────────────────────────

  listTemplates(
    holderType?: IdCardHolderType
  ): Observable<{ success: boolean; templates: IdCardTemplate[] }> {
    const path = holderType
      ? `school/id-cards/templates?holderType=${holderType}`
      : 'school/id-cards/templates';
    return this.api.get<{ success: boolean; templates: IdCardTemplate[] }>(path);
  }

  createTemplate(data: {
    name: string;
    holderType: IdCardHolderType;
    layoutConfig: IdCardLayoutConfig;
    isDefault?: boolean;
  }): Observable<{ success: boolean; template: IdCardTemplate }> {
    return this.api.post<{ success: boolean; template: IdCardTemplate }>(
      'school/id-cards/templates',
      data
    );
  }

  updateTemplate(
    id: number,
    data: Partial<{
      name: string;
      holderType: IdCardHolderType;
      layoutConfig: IdCardLayoutConfig;
      isDefault: boolean;
    }>
  ): Observable<{ success: boolean; message: string }> {
    return this.api.put<{ success: boolean; message: string }>(
      `school/id-cards/templates/${id}`,
      data
    );
  }

  deleteTemplate(id: number): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(
      `school/id-cards/templates/${id}`
    );
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  generateCard(data: GenerateCardInput): Observable<{ success: boolean; cardId: number }> {
    return this.api.post<{ success: boolean; cardId: number }>('school/id-cards/generate', data);
  }

  generateCardsBulk(
    data: GenerateBulkInput
  ): Observable<{ success: boolean } & GenerateBulkResult> {
    return this.api.post<{ success: boolean } & GenerateBulkResult>(
      'school/id-cards/generate/bulk',
      data
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────

  listCards(filters?: {
    holderType?: IdCardHolderType;
    status?: IdCardStatus;
  }): Observable<{ success: boolean; cards: IdCardListItem[] }> {
    const params = new URLSearchParams();
    if (filters?.holderType) params.set('holderType', filters.holderType);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return this.api.get<{ success: boolean; cards: IdCardListItem[] }>(
      `school/id-cards${query ? `?${query}` : ''}`
    );
  }

  // ── Card data (for rendering/printing) ───────────────────────────────────

  getCardData(id: number): Observable<{ success: boolean; card: IdCardData }> {
    return this.api.get<{ success: boolean; card: IdCardData }>(`school/id-cards/${id}/data`);
  }

  getCardsDataBulk(cardIds: number[]): Observable<{ success: boolean; cards: IdCardData[] }> {
    return this.api.post<{ success: boolean; cards: IdCardData[] }>('school/id-cards/data/bulk', {
      cardIds,
    });
  }

  // ── Revoke / Reissue ──────────────────────────────────────────────────────

  revokeCard(id: number, reason: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>(`school/id-cards/${id}/revoke`, {
      reason,
    });
  }

  reissueCard(
    id: number,
    overrides?: { templateId?: number; validUntil?: string }
  ): Observable<{ success: boolean; newCardId: number }> {
    return this.api.post<{ success: boolean; newCardId: number }>(
      `school/id-cards/${id}/reissue`,
      overrides ?? {}
    );
  }
}
