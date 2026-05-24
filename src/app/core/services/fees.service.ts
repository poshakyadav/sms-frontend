// core/services/fees.service.ts
// Production-grade fees service — covers every backend endpoint in the fees module.

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'CASH' | 'CHECK' | 'BANK_TRANSFER';
export type FeeStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
export type ConcessionType = 'PERCENTAGE' | 'FIXED';
export type FeeSource = 'STRUCTURE' | 'ASSIGNMENT';

// ─────────────────────────────────────────────────────────────────────────────
// FEE STRUCTURES
// ─────────────────────────────────────────────────────────────────────────────

export interface FeeStructure {
  id: number;
  academicYearId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  feeType: string;
  feeMonth: string | null;
  amount: number; // paise
  dueDate: string | null;
  isMandatory: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeStructurePayload {
  academicYearId: number;
  classSectionId: number;
  feeType: string;
  amount: number; // paise
  feeMonth?: string | null;
  dueDate?: string | null;
  isMandatory?: boolean;
  description?: string | null;
}

export interface BulkMonthlyStructurePayload {
  academicYearId: number;
  classSectionId: number;
  feeType: string;
  amount: number;
  startMonth: string; // "YYYY-MM"
  endMonth: string; // "YYYY-MM"
  dueDayOfMonth?: number; // 1–28
  description?: string | null;
  isMandatory?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCESSIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface FeeConcession {
  id: number;
  source: FeeSource;
  feeStructureId: number | null;
  studentFeeAssignmentId: number | null;
  feeType: string;
  feeMonth: string | null;
  originalAmount: number;
  concessionType: ConcessionType;
  concessionValue: number;
  // Backend returns concessionAmount (not discountAmount) — see getConcessionsForStudent
  concessionAmount: number;
  effectiveAmount: number;
  reason: string;
  isActive: boolean;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * FIX: Backend requires exactly one of feeStructureId or studentFeeAssignmentId.
 * The payload must contain one — not both, not neither.
 *
 * Use a discriminated union so callers are forced to choose at the type level:
 *
 *   createConcession({ enrollmentId: 1, feeStructureId: 5, ... })       ← STRUCTURE mode
 *   createConcession({ enrollmentId: 1, studentFeeAssignmentId: 3, ... }) ← ASSIGNMENT mode
 */
export type CreateConcessionPayload =
  | {
      enrollmentId: number;
      feeStructureId: number;
      studentFeeAssignmentId?: never;
      concessionType: ConcessionType;
      concessionValue: number;
      reason: string;
    }
  | {
      enrollmentId: number;
      feeStructureId?: never;
      studentFeeAssignmentId: number;
      concessionType: ConcessionType;
      concessionValue: number;
      reason: string;
    };

export interface ConcessionDashboardRow {
  concessionId: number;
  enrollmentId: number;
  studentName: string;
  studentId: number;
  className: string;
  sectionName: string;
  source: FeeSource;
  feeType: string;
  feeMonth: string | null;
  originalAmount: number;
  concessionType: ConcessionType;
  concessionValue: number;
  concessionAmount: number;
  effectiveAmount: number;
  reason: string;
  approvedByName: string;
  isActive: boolean;
  createdAt: string;
}

export interface ConcessionDashboardResponse {
  rows: ConcessionDashboardRow[];
  totalConcessionAmount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT FEE ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentFeeAssignment {
  id: number;
  enrollmentId: number;
  academicYearId: number;
  feeType: string;
  amount: number;
  feeMonth: string | null;
  dueDate: string | null;
  description: string | null;
  isMandatory: boolean;
  assignedBy: number;
  isCancelled: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  // Computed by service
  concessionAmount: number;
  concessionReason: string | null;
  effectiveAmount: number;
  amountPaid: number;
  balance: number;
  status: FeeStatus;
}

export interface CreateAssignmentPayload {
  enrollmentId: number;
  academicYearId: number;
  feeType: string;
  amount: number;
  feeMonth?: string | null;
  dueDate?: string | null;
  description?: string | null;
  isMandatory?: boolean;
}

export interface BulkMonthlyAssignmentPayload {
  enrollmentId: number;
  academicYearId: number;
  feeType: string;
  amount: number;
  startMonth: string;
  endMonth: string;
  dueDayOfMonth?: number;
  description?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentItem {
  feeStructureId?: number;
  studentFeeAssignmentId?: number;
  amountPaid: number;
}

export interface RecordPaymentPayload {
  enrollmentId: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  // Single payment (legacy modes)
  feeStructureId?: number;
  studentFeeAssignmentId?: number;
  amountPaid?: number;
  // Multi-payment
  payments?: PaymentItem[];
}

export interface RecordPaymentResult {
  payment: any;
  payments: any[];
  message: string;
  meta: {
    receiptNumbers: string[];
    totalPaid: number;
    paymentCount: number;
  };
}

export interface PaymentHistoryRow {
  id: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  receiptNumber: string;
  feeType: string;
  feeMonth: string | null;
  dueDate: string | null;
  source: FeeSource;
  isVoid: boolean;
  notes: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DUE FEES
// ─────────────────────────────────────────────────────────────────────────────

export interface DueFeeItem {
  id: number;
  source: FeeSource;
  feeType: string;
  feeMonth: string | null;
  amount: number;
  concessionAmount: number;
  effectiveAmount: number;
  concessionReason: string | null;
  dueDate: string | null;
  isMandatory: boolean;
  description: string | null;
  paid: number;
  remaining: number;
}

export interface DueFeesResponse {
  fees: DueFeeItem[];
  assignments: DueFeeItem[];
  totalDue: number;
  totalPaid: number;
  balanceDue: number;
  totalConcession: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT LEDGER
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerFeeDetail {
  id: number;
  feeType: string;
  feeMonth: string | null;
  amount: number;
  concessionAmount: number;
  effectiveAmount: number;
  concessionReason: string | null;
  dueDate: string | null;
  isMandatory: boolean;
}

export interface LedgerAssignmentDetail extends LedgerFeeDetail {
  description: string | null;
  isCancelled: boolean;
}

export interface StudentLedgerEntry {
  yearId: number;
  academicYearName: string;
  studentName: string;
  className: string;
  sectionName: string;
  rollNumber: string | null;
  totalOriginal: number;
  totalConcession: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  details: {
    fees: LedgerFeeDetail[];
    assignments: LedgerAssignmentDetail[];
    payments: PaymentHistoryRow[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE REPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface FeeReportRow {
  studentId: number;
  enrollmentId: number;
  studentName: string;
  rollNumber: string | null;
  className: string;
  sectionName: string;
  academicYearName: string;
  totalOriginal: number;
  totalConcession: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  customFeeTotal: number;
  customFeeConcession: number;
  customFeeEffective: number;
  customFeePaid: number;
  customFeeBalance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export interface FeesDashboard {
  totalAssigned: number;
  totalConcession: number;
  totalEffectiveAssigned: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  collectionRate: number;
  totalCustomAssigned: number;
  totalCustomConcession: number;
  totalCustomEffective: number;
  totalCustomCollected: number;
  totalCustomOutstanding: number;
  grandTotalAssigned: number;
  grandTotalCollected: number;
  grandTotalOutstanding: number;
  todayCollected: number;
  academicYearId: number | undefined;
}

export interface CollectionTrendPoint {
  date: string;
  amount: number;
}

export interface ClassSectionBreakdown {
  className: string;
  sectionName: string;
  totalAssigned: number;
  totalCollected: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS BY CLASS-SECTION
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentForPayment {
  id: number;
  name: string;
  email: string;
  rollNumber: string | null;
  enrollmentId: number;
  totalOriginal: number;
  totalConcession: number;
  totalAssigned: number;
  totalPaid: number;
  balance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT PORTAL
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentFeeItem {
  id: number;
  source: FeeSource;
  feeType: string;
  feeMonth: string | null;
  originalAmount: number;
  concessionAmount: number;
  effectiveAmount: number;
  concessionReason: string | null;
  dueDate: string | null;
  isMandatory: boolean;
  description: string | null;
  amountPaid: number;
  balance: number;
  status: FeeStatus;
}

export interface StudentPaymentItem {
  id: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  receiptNumber: string;
  feeType: string;
  notes: string | null;
}

export interface StudentFeeOverview {
  academicYearId: number;
  academicYearName: string;
  className: string;
  sectionName: string;
  rollNumber: string | null;
  totalOriginal: number;
  totalConcession: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  collectionRate: number;
  feeBreakdown: StudentFeeItem[];
  recentPayments: StudentPaymentItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PARENT PORTAL
// ─────────────────────────────────────────────────────────────────────────────

export interface ParentChildFeeOverview extends StudentFeeOverview {
  studentName: string;
  studentEmail: string;
  studentId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: paise ↔ rupee conversions (used by components)
// ─────────────────────────────────────────────────────────────────────────────

/** Rupees → paise (multiply before sending to API) */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Paise → rupees (divide after receiving from API) */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FeesService {
  private readonly base = 'school/fees';

  constructor(private api: ApiService) {}

  // ── Fee Structures ─────────────────────────────────────────────────────────

  getFeeStructures(): Observable<FeeStructure[]> {
    return this.api
      .get<{ structures: FeeStructure[] }>(`${this.base}/structures`)
      .pipe(map((r) => r.structures ?? []));
  }

  createFeeStructure(
    data: CreateFeeStructurePayload
  ): Observable<{ structure: FeeStructure; message: string }> {
    return this.api.post(`${this.base}/structures`, data);
  }

  createBulkMonthlyStructures(
    data: BulkMonthlyStructurePayload
  ): Observable<{ structures: FeeStructure[]; monthCount: number; message: string }> {
    return this.api.post(`${this.base}/structures/bulk-monthly`, data);
  }

  updateFeeStructure(
    id: number,
    data: Partial<CreateFeeStructurePayload>
  ): Observable<{ structure: FeeStructure; message: string }> {
    return this.api.put(`${this.base}/structures/${id}`, data);
  }

  deleteFeeStructure(id: number): Observable<{ message: string }> {
    return this.api.delete(`${this.base}/structures/${id}`);
  }

  // ── Concessions ────────────────────────────────────────────────────────────

  /**
   * Accepts a discriminated union payload so exactly one of
   * feeStructureId or studentFeeAssignmentId is present — matching the
   * backend's Zod schema which requires exactly one, not both, not neither.
   *
   * The payload is sent as-is; the `never` fields are stripped by TypeScript
   * so they never reach the JSON body.
   */
  createConcession(data: CreateConcessionPayload): Observable<{
    concession: any;
    originalAmount: number;
    discountAmount: number;
    effectiveAmount: number;
    message: string;
  }> {
    return this.api.post(`${this.base}/concessions`, data);
  }

  revokeConcession(id: number): Observable<{ message: string; concession: any }> {
    return this.api.patch(`${this.base}/concessions/${id}/revoke`, {});
  }

  /**
   * Returns all concessions (active + historical) for an enrollment.
   * Backend returns `concessionAmount` (not `discountAmount`).
   */
  getConcessionsForEnrollment(enrollmentId: number): Observable<FeeConcession[]> {
    return this.api
      .get<{ concessions: FeeConcession[] }>(`${this.base}/concessions/${enrollmentId}`)
      .pipe(map((r) => r.concessions ?? []));
  }

  getConcessionDashboard(
    academicYearId?: number,
    classSectionId?: number
  ): Observable<ConcessionDashboardResponse> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    if (classSectionId) params = params.set('classSectionId', classSectionId);
    return this.api.get(`${this.base}/concessions/dashboard`, params);
  }

  // ── Student Fee Assignments ────────────────────────────────────────────────

  createStudentFeeAssignment(
    data: CreateAssignmentPayload & { assignedBy?: number }
  ): Observable<{ assignment: StudentFeeAssignment; message: string }> {
    return this.api.post(`${this.base}/assignments`, data);
  }

  createBulkMonthlyAssignments(
    data: BulkMonthlyAssignmentPayload
  ): Observable<{ assignments: StudentFeeAssignment[]; monthCount: number; message: string }> {
    return this.api.post(`${this.base}/assignments/bulk-monthly`, data);
  }

  /**
   * @param includeAll When true, returns all assignments including cancelled.
   *                   When false (default), returns only active (non-cancelled) assignments.
   */
  getStudentFeeAssignments(
    enrollmentId: number,
    includeAll = false
  ): Observable<StudentFeeAssignment[]> {
    const params = new HttpParams().set('includeAll', String(includeAll));
    return this.api
      .get<{ assignments: StudentFeeAssignment[] }>(
        `${this.base}/assignments/${enrollmentId}`,
        params
      )
      .pipe(map((r) => r.assignments ?? []));
  }

  cancelStudentFeeAssignment(
    id: number,
    reason: string
  ): Observable<{ message: string; assignment: StudentFeeAssignment }> {
    return this.api.patch(`${this.base}/assignments/${id}/cancel`, { reason });
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  recordFeePayment(data: RecordPaymentPayload): Observable<RecordPaymentResult> {
    return this.api.post(`${this.base}/payments`, data);
  }

  voidFeePayment(
    id: number,
    reason: string
  ): Observable<{
    message: string;
    payment: any;
    voidedReceiptNumber: string;
    voidedAmount: number;
  }> {
    return this.api.patch(`${this.base}/payments/${id}/void`, { reason });
  }

  // ── Due Fees ───────────────────────────────────────────────────────────────

  getDueFeesForEnrollment(enrollmentId: number): Observable<DueFeesResponse> {
    return this.api.get(`${this.base}/due-fees/${enrollmentId}`);
  }

  getPaymentHistory(enrollmentId: number): Observable<PaymentHistoryRow[]> {
    return this.api
      .get<{ history: PaymentHistoryRow[] }>(`${this.base}/payments-history/${enrollmentId}`)
      .pipe(map((r) => r.history ?? []));
  }

  // ── Ledger ─────────────────────────────────────────────────────────────────

  getStudentLedger(studentId: number, academicYearId?: number): Observable<StudentLedgerEntry[]> {
    let params = new HttpParams().set('studentId', studentId);
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    return this.api
      .get<{ ledger: StudentLedgerEntry[] }>(`${this.base}/ledger`, params)
      .pipe(map((r) => r.ledger ?? []));
  }

  // ── Fee Report ─────────────────────────────────────────────────────────────

  getFeeReport(
    classSectionId: number,
    academicYearId?: number,
    overdueOnly?: boolean
  ): Observable<FeeReportRow[]> {
    let params = new HttpParams().set('classSectionId', classSectionId);
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    if (overdueOnly) params = params.set('overdueOnly', 'true');
    return this.api
      .get<{ report: FeeReportRow[] }>(`${this.base}/report`, params)
      .pipe(map((r) => r.report ?? []));
  }

  // ── Students by Class-Section ──────────────────────────────────────────────

  getStudentsByClassSection(classSectionId: number): Observable<StudentForPayment[]> {
    const params = new HttpParams().set('classSectionId', classSectionId);
    return this.api
      .get<{ students: StudentForPayment[] }>(`${this.base}/students-by-class-section`, params)
      .pipe(map((r) => r.students ?? []));
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  getFeesDashboard(academicYearId?: number, classSectionId?: number): Observable<FeesDashboard> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    if (classSectionId) params = params.set('classSectionId', classSectionId);
    return this.api
      .get<{ dashboard: FeesDashboard }>(`${this.base}/dashboard`, params)
      .pipe(map((r) => r.dashboard));
  }

  getCollectionTrend(
    academicYearId?: number,
    classSectionId?: number
  ): Observable<CollectionTrendPoint[]> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    if (classSectionId) params = params.set('classSectionId', classSectionId);
    return this.api
      .get<{ trend: CollectionTrendPoint[] }>(`${this.base}/dashboard/trend`, params)
      .pipe(map((r) => r.trend ?? []));
  }

  getClassSectionBreakdown(
    academicYearId?: number,
    classSectionId?: number
  ): Observable<ClassSectionBreakdown[]> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    if (classSectionId) params = params.set('classSectionId', classSectionId);
    return this.api
      .get<{ breakdown: ClassSectionBreakdown[] }>(`${this.base}/dashboard/breakdown`, params)
      .pipe(map((r) => r.breakdown ?? []));
  }

  // ── Student Portal ─────────────────────────────────────────────────────────

  getStudentOwnFees(academicYearId?: number): Observable<StudentFeeOverview[]> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    return this.api
      .get<{ success: boolean; overview: StudentFeeOverview[] }>(
        `${this.base}/student/my-fees`,
        params
      )
      .pipe(map((r) => r.overview ?? []));
  }

  // ── Parent Portal ──────────────────────────────────────────────────────────

  getParentChildFees(academicYearId?: number): Observable<ParentChildFeeOverview[]> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    return this.api
      .get<{ success: boolean; overview: ParentChildFeeOverview[] }>(
        `${this.base}/parent/child-fees`,
        params
      )
      .pipe(map((r) => r.overview ?? []));
  }
}
