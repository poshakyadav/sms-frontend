// fees.service.ts — UPDATED
// Changes:
// 1. DueFee.remaining is now guaranteed >= 0
// 2. recordFeePayment now accepts optional `payments` array for distributed "Pay All" mode
// 3. FeePayment response now includes `payments` array

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FeeStructure {
  id: number;
  academicYearId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  feeType: string;
  amount: number;
  dueDate?: string;
  isMandatory: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeePayment {
  id: number;
  enrollmentId: number;
  feeStructureId: number;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
  receiptNumber: string;
  notes?: string;
  recordedBy: number;
  isVoid: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment row as returned by getStudentLedger — the backend joins feeType
 * and dueDate from school_fee_structures so the ledger can display them
 * without a second lookup. This shape is ONLY used inside StudentLedger.details.
 */
export interface LedgerPayment {
  id: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
  receiptNumber: string;
  notes?: string | null;
  feeType: string;   // joined from fee_structures
  dueDate?: string;  // joined from fee_structures
}

export interface StudentLedger {
  yearId: number;
  academicYearName: string;
  studentName: string;
  className: string;
  sectionName: string;
  rollNumber?: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  details: {
    fees: FeeStructure[];
    payments: LedgerPayment[];
  };
}

export interface FeeReportItem {
  studentId: number;
  enrollmentId: number;
  studentName: string;
  rollNumber: string | null;
  className: string;
  sectionName: string;
  academicYearName: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

export interface EnrolledStudent {
  id: number;
  name: string;
  email: string;
  rollNumber: string;
  enrollmentId: number;
  balance: number;
  totalPaid: number;
  totalAssigned: number;
}

export interface DueFee {
  id: number;
  feeType: string;
  amount: number;
  dueDate?: string;
  isMandatory: boolean;
  description?: string;
  paid: number;
  remaining: number; // always >= 0
}

export interface DueFeesResponse {
  fees: DueFee[]; // ALL fees (including cleared) — filter in UI
  totalDue: number;
  totalPaid: number;
  balanceDue: number;
}

export interface PaymentHistory {
  id: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
  receiptNumber: string;
  notes?: string;
  feeType: string;
  dueDate?: string;
}

export interface FeesDashboard {
  totalAssigned: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  collectionRate: number;
  todayCollected: number;
  academicYearId?: number;
}

export interface FeesTrendItem {
  date: string;
  amount: number;
}

export interface FeesBreakdownItem {
  className: string;
  sectionName: string;
  totalAssigned: number;
  totalCollected: number;
}

// ── New: per-fee payment item for distributed payments ────────────────────────
export interface DistributedPaymentItem {
  feeStructureId: number;
  amountPaid: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FeesService {
  constructor(private api: ApiService) {}

  // ── Fee Structures ─────────────────────────────────────────────────────────

  getFeeStructures(): Observable<{ structures: FeeStructure[] }> {
    return this.api.get<{ structures: FeeStructure[] }>('school/fees/structures');
  }

  createFeeStructure(
    data: Partial<FeeStructure>
  ): Observable<{ structure: FeeStructure; message: string }> {
    return this.api.post('school/fees/structures', data);
  }

  updateFeeStructure(
    id: number,
    data: Partial<FeeStructure>
  ): Observable<{ structure: FeeStructure; message: string }> {
    return this.api.put(`school/fees/structures/${id}`, data);
  }

  deleteFeeStructure(id: number): Observable<{ message: string }> {
    return this.api.delete(`school/fees/structures/${id}`);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  /**
   * Record a fee payment.
   *
   * Two modes:
   * 1. Single fee:  pass `feeStructureId` + `amountPaid`
   * 2. Distributed: pass `payments` array (used by "Pay All" in the dialog)
   *
   * The backend now accepts both shapes in one endpoint.
   */
  recordFeePayment(data: {
    enrollmentId: number;
    paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
    notes?: string;
    // Single fee mode
    feeStructureId?: number;
    amountPaid?: number;
    // Distributed mode
    payments?: DistributedPaymentItem[];
  }): Observable<{ payment: FeePayment; payments: FeePayment[]; message: string }> {
    return this.api.post('school/fees/payments', data);
  }

  // ── Ledger ─────────────────────────────────────────────────────────────────

  getStudentLedger(
    studentId: number,
    academicYearId?: number
  ): Observable<{ ledger: StudentLedger[] }> {
    let params = new HttpParams().set('studentId', studentId.toString());
    if (academicYearId) params = params.set('academicYearId', academicYearId.toString());
    return this.api.get<{ ledger: StudentLedger[] }>('school/fees/ledger', params);
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  getFeeReport(
    classSectionId: number,
    academicYearId?: number,
    overdueOnly?: boolean
  ): Observable<{ report: FeeReportItem[] }> {
    let params = new HttpParams().set('classSectionId', classSectionId.toString());
    if (academicYearId) params = params.set('academicYearId', academicYearId.toString());
    if (overdueOnly !== undefined) params = params.set('overdueOnly', overdueOnly.toString());
    return this.api.get<{ report: FeeReportItem[] }>('school/fees/report', params);
  }

  // ── Students by Class-Section ──────────────────────────────────────────────

  getStudentsByClassSection(classSectionId: number): Observable<{ students: EnrolledStudent[] }> {
    const params = new HttpParams().set('classSectionId', classSectionId.toString());
    return this.api.get<{ students: EnrolledStudent[] }>(
      'school/fees/students-by-class-section',
      params
    );
  }

  // ── Due Fees & Payment History ─────────────────────────────────────────────

  getDueFeesForEnrollment(enrollmentId: number): Observable<DueFeesResponse> {
    return this.api.get<DueFeesResponse>(`school/fees/due-fees/${enrollmentId}`);
  }

  getPaymentsForEnrollment(enrollmentId: number): Observable<{ history: PaymentHistory[] }> {
    return this.api.get<{ history: PaymentHistory[] }>(
      `school/fees/payments-history/${enrollmentId}`
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  getFeesDashboard(
    academicYearId?: number,
    classSectionId?: number
  ): Observable<{ dashboard: FeesDashboard }> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId.toString());
    if (classSectionId) params = params.set('classSectionId', classSectionId.toString());
    return this.api.get<{ dashboard: FeesDashboard }>('school/fees/dashboard', params);
  }

  getFeesCollectionTrend(
    academicYearId?: number,
    classSectionId?: number
  ): Observable<{ trend: FeesTrendItem[] }> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId.toString());
    if (classSectionId) params = params.set('classSectionId', classSectionId.toString());
    return this.api.get<{ trend: FeesTrendItem[] }>('school/fees/dashboard/trend', params);
  }

  getFeesClassSectionBreakdown(
    academicYearId?: number,
    classSectionId?: number
  ): Observable<{ breakdown: FeesBreakdownItem[] }> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId.toString());
    if (classSectionId) params = params.set('classSectionId', classSectionId.toString());
    return this.api.get<{ breakdown: FeesBreakdownItem[] }>(
      'school/fees/dashboard/breakdown',
      params
    );
  }
}
