// core/services/fee-receipt.service.ts
import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FeeSource, PaymentMethod } from './fees.service';

export interface FeeReceiptLineItem {
  id: number;
  receiptNumber: string;
  source: FeeSource;
  feeType: string;
  feeMonth: string | null;
  originalAmount: number;
  concessionAmount: number;
  effectiveAmount: number;
  amountPaid: number;
  isVoid: boolean;
}

export interface FeeReceiptSchoolInfo {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  addressLineOne: string;
  addressLineTwo: string;
  phone: string;
  email: string;
}

export interface FeeReceiptStudentInfo {
  name: string;
  rollNumber: string | null;
  className: string;
  sectionName: string;
  academicYearName: string;
}

export interface FeeReceiptData {
  batchId: string | null;
  primaryReceiptNumber: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
  totalPaid: number;
  items: FeeReceiptLineItem[];
  recordedByName: string | null;
  student: FeeReceiptStudentInfo;
  school: FeeReceiptSchoolInfo;
}

export interface FeeItemPaymentRow {
  id: number;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  isVoid: boolean;
  batchId: string | null;
  hasSiblingsOutsideThisItem: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeeReceiptService {
  private readonly base = 'school/fees';

  constructor(private api: ApiService) { }

  getReceiptByPaymentId(paymentId: number): Observable<FeeReceiptData> {
    return this.api
      .get<{ receipt: FeeReceiptData }>(`${this.base}/receipt/${paymentId}`)
      .pipe(map((r) => r.receipt));
  }

  getPaymentsForFeeItem(
    enrollmentId: number,
    source: FeeSource,
    feeId: number
  ): Observable<FeeItemPaymentRow[]> {
    let params = new HttpParams().set('enrollmentId', enrollmentId);
    params =
      source === 'STRUCTURE'
        ? params.set('feeStructureId', feeId)
        : params.set('studentFeeAssignmentId', feeId);

    return this.api
      .get<{ payments: FeeItemPaymentRow[] }>(`${this.base}/item-payments`, params)
      .pipe(map((r) => r.payments ?? []));
  }

  /**
   * Pure, no-HTTP builder — used immediately after a successful payment so
   * the receipt appears instantly from data already in memory, with no
   * round-trip and no read-after-write race. Original/concession breakdown
   * isn't available at this point (the result dialog only carries feeType +
   * amountPaid), so items render at their paid amount only — the detailed
   * concession breakdown remains visible in the payment dialog itself.
   */
  buildFromPaymentResult(params: {
    school: FeeReceiptSchoolInfo;
    student: FeeReceiptStudentInfo;
    paymentMethod: PaymentMethod;
    notes?: string;
    payments: Array<{
      id?: number;
      feeType: string;
      feeMonth?: string | null;
      amountPaid: number;
      receiptNumber: string;
      source?: FeeSource;
    }>;
    totalPaid: number;
  }): FeeReceiptData {
    const items: FeeReceiptLineItem[] = params.payments.map((p, idx) => ({
      id: p.id ?? idx,
      receiptNumber: p.receiptNumber,
      source: p.source ?? 'STRUCTURE',
      feeType: p.feeType,
      feeMonth: p.feeMonth ?? null,
      originalAmount: p.amountPaid,
      concessionAmount: 0,
      effectiveAmount: p.amountPaid,
      amountPaid: p.amountPaid,
      isVoid: false,
    }));

    return {
      batchId: null,
      primaryReceiptNumber: params.payments[0]?.receiptNumber ?? '',
      paymentDate: new Date().toISOString(),
      paymentMethod: params.paymentMethod,
      notes: params.notes ?? null,
      totalPaid: params.totalPaid,
      items,
      recordedByName: null,
      student: params.student,
      school: params.school,
    };
  }
}