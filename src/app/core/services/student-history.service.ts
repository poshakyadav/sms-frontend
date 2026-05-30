// src/app/core/services/student-history.service.ts

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentSearchResult {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  admissionNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isDeparted: boolean;
  fatherName: string | null;
  gender: string | null;
  currentEnrollment: {
    className: string;
    sectionName: string;
    academicYearName: string;
  } | null;
  lastEnrollment: {
    className: string;
    sectionName: string;
    academicYearName: string;
    unenrolledAt: string | null;
    unenrollmentType: string | null;
  } | null;
}

export interface EnrollmentRecord {
  enrollmentId: number;
  academicYearId: number;
  academicYearName: string;
  className: string;
  sectionName: string;
  classSectionId: number;
  rollNumber: string | null;
  enrollmentDate: string | null;
  isActive: boolean;
  unenrollmentType: string | null;
  unenrollmentReason: string | null;
  unenrolledAt: string | null;
}

export interface AttendanceSummary {
  academicYearId: number;
  academicYearName: string;
  className: string;
  sectionName: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  excusedDays: number;
  attendancePercentage: number;
}

export interface AcademicPerformanceSummary {
  academicYearId: number;
  academicYearName: string;
  className: string;
  sectionName: string;
  exams: Array<{
    examId: number;
    examName: string;
    examType: string;
    subjectResults: Array<{
      subjectName: string;
      marksObtained: number;
      maxMarks: number;
      grade: string | null;
    }>;
    totalMarks: number;
    totalMaxMarks: number;
    percentage: number;
  }>;
}

export interface FeeSummary {
  academicYearId: number;
  academicYearName: string;
  totalCharged: number;
  totalPaid: number;
  totalConcession: number;
  balance: number;
  paymentCount: number;
}

export interface HistoryEvent {
  id: string;
  eventType: string;
  date: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  academicYear?: { id: number; name: string } | null;
  classSection?: { className: string; sectionName: string } | null;
}

export interface StudentHistorySummary {
  student: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    alternatePhone: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    isDeparted: boolean;
    createdAt: string;
    gender: string | null;
    dateOfBirth: string | null;
    fatherName: string | null;
    motherName: string | null;
    guardianName: string | null;
    addressLineOne: string | null;
    city: string | null;
    state: string | null;
    admissionNumber: string | null;
    admissionDate: string | null;
    rollNumber: string | null;
    medicalInfo: string | null;
    pen: string | null;
    apaarId: string | null;
  };
  currentEnrollment: {
    className: string;
    sectionName: string;
    academicYearName: string;
    rollNumber: string | null;
  } | null;
  lastEnrollment: {
    className: string;
    sectionName: string;
    academicYearName: string;
    unenrolledAt: string | null;
    unenrollmentType: string | null;
    unenrollmentReason: string | null;
  } | null;
  enrollmentHistory: Array<{
    academicYearName: string;
    className: string;
    sectionName: string;
    rollNumber: string | null;
    enrollmentDate: string | null;
    isActive: boolean;
    unenrolledAt: string | null;
    unenrollmentType: string | null;
    unenrollmentReason: string | null;
  }>;
  linkedParents: Array<{
    parentId: number;
    parentName: string;
    parentEmail: string;
    parentPhone: string | null;
    relationship: string;
    isPrimary: boolean;
  }>;
  stats: {
    totalYearsEnrolled: number;
    workingDays: number;
    presentDays: number;
    absentDays: number;
    attendancePercentage: number | null;
    totalFeePaidRupees: number;
    totalExamMarksEntered: number;
  };
}

export interface StudentHistoryResponse {
  success: boolean;
  student: {
    id: number;
    name: string;
    email: string;
    primaryRole: string;
    avatarUrl: string | null;
    admissionNumber: string | null;
    rollNumber: string | null;
    admissionDate: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    fatherName: string | null;
    motherName: string | null;
    guardianName: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
  };
  isDeparted: boolean;
  enrollments: EnrollmentRecord[];
  attendanceSummaries: AttendanceSummary[];
  academicPerformance: AcademicPerformanceSummary[];
  feeSummaries: FeeSummary[];
  events: HistoryEvent[];
  pagination: {
    page: number;
    limit: number;
    totalEvents: number;
    totalPages: number;
  };
}

export interface AllStudentsHistoryResponse {
  success: boolean;
  students: AllStudentRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AllStudentRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isDeparted: boolean;
  createdAt: string;
  gender: string | null;
  dateOfBirth: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  admissionNumber: string | null;
  rollNumber: string | null;
  admissionDate: string | null;
  totalYearsEnrolled: number;
  currentEnrollment: {
    className: string;
    sectionName: string;
    academicYearName: string;
  } | null;
  lastEnrollment: {
    className: string;
    sectionName: string;
    academicYearName: string;
    unenrolledAt: string | null;
    unenrollmentType: string | null;
  } | null;
  stats: {
    workingDays: number;
    presentDays: number;
    absentDays: number;
    attendancePercentage: number | null;
    totalFeePaidRupees: number;
    totalExamMarksEntered: number;
  };
}

// ── Query params ──────────────────────────────────────────────────────────────

export interface HistoryQueryParams {
  academicYearId?: number;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AllStudentsHistoryParams {
  q?: string;
  name?: string;
  email?: string;
  phone?: string;
  admissionNumber?: string;
  fatherName?: string;
  motherName?: string;
  rollNumber?: string;
  status?: 'active' | 'departed' | 'all';
  academicYearId?: number;
  sortBy?: 'name' | 'admissionDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface StudentSearchParams {
  q: string;
  status?: 'active' | 'departed' | 'all';
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StudentHistoryService {
  private base = 'school/students/history';

  constructor(private api: ApiService) {}

  /**
   * GET /school/students/history/search
   * Fast autocomplete — returns lightweight student matches.
   */
  searchStudents(
    params: StudentSearchParams
  ): Observable<{ success: boolean; results: StudentSearchResult[] }> {
    let httpParams = new HttpParams().set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    return this.api.get<{ success: boolean; results: StudentSearchResult[] }>(
      `${this.base}/search`,
      httpParams
    );
  }

  /**
   * GET /school/students/history
   * Paginated list of all students with optional filters.
   */
  getAllStudentsHistory(
    params: AllStudentsHistoryParams = {}
  ): Observable<AllStudentsHistoryResponse> {
    let httpParams = new HttpParams();
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.name) httpParams = httpParams.set('name', params.name);
    if (params.email) httpParams = httpParams.set('email', params.email);
    if (params.phone) httpParams = httpParams.set('phone', params.phone);
    if (params.admissionNumber)
      httpParams = httpParams.set('admissionNumber', params.admissionNumber);
    if (params.fatherName) httpParams = httpParams.set('fatherName', params.fatherName);
    if (params.motherName) httpParams = httpParams.set('motherName', params.motherName);
    if (params.rollNumber) httpParams = httpParams.set('rollNumber', params.rollNumber);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.academicYearId != null)
      httpParams = httpParams.set('academicYearId', String(params.academicYearId));
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);
    if (params.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    return this.api.get<AllStudentsHistoryResponse>(this.base, httpParams);
  }

  /**
   * GET /school/students/history/:id/summary
   * Lightweight stats card for one student.
   */
  getStudentHistorySummary(
    studentId: number
  ): Observable<{ success: boolean; summary: StudentHistorySummary }> {
    return this.api.get<{ success: boolean; summary: StudentHistorySummary }>(
      `${this.base}/${studentId}/summary`
    );
  }

  /**
   * GET /school/students/history/:id
   * Full paginated event timeline for one student.
   */
  getStudentHistory(
    studentId: number,
    params: HistoryQueryParams = {}
  ): Observable<StudentHistoryResponse> {
    let httpParams = new HttpParams();
    if (params.academicYearId != null)
      httpParams = httpParams.set('academicYearId', String(params.academicYearId));
    if (params.eventType) httpParams = httpParams.set('eventType', params.eventType);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    return this.api.get<StudentHistoryResponse>(`${this.base}/${studentId}`, httpParams);
  }
}
