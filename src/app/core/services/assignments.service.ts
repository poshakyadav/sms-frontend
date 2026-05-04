// assignments.service.ts

import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedAssignment {
  id: number;
  teacherAssignmentId: number;
  classSectionId: number;
  type: 'CLASS_WORK' | 'HOME_WORK' | 'ASSIGNMENT';
  title: string;
  description: string;
  dueDate?: string | null;
  targetDate?: string | null;
  maxMarks?: number | null;
  isMandatory: boolean;
  enteredBy: number;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
  // Student-specific (only present on student view)
  studentStatus?: 'PENDING' | 'MARKED_AS_DONE';
  teacherStatus?: 'NOT_RECEIVED' | 'RECEIVED' | 'GRADED';
  marksObtained?: number | null;
  receivedAt?: string | null;
}

export interface CreateAssignmentPayload {
  teacherAssignmentId: number;
  classSectionId: number;
  type: 'CLASS_WORK' | 'HOME_WORK' | 'ASSIGNMENT';
  title: string;
  description: string;
  targetDate?: string | null;
  dueDate?: string | null;
  maxMarks?: number | null;
  isMandatory: boolean;
}

export interface SubmissionRow {
  enrollmentId: number;
  studentName: string;
  rollNumber: string;
  studentStatus: 'PENDING' | 'MARKED_AS_DONE';
  teacherStatus: 'NOT_RECEIVED' | 'RECEIVED' | 'GRADED';
  marksObtained?: number | null;
  remarks?: string;
  receivedAt?: string | null;
}

export interface SubmissionsReport {
  report: SubmissionRow[];
  aggregates: {
    totalStudents: number;
    completed: number;
    completionRate: string;
    avgMarks: number;
  };
}

export interface AssignmentFilters {
  dateFrom?: string;
  dateTo?: string;
  classSubjectId?: number;
  classSectionId?: number;
  teacherId?: number;
  limit?: number;
  offset?: number;
}

export interface StudentAssignmentFilters {
  studentId?: number;
  dateFrom?: string;
  dateTo?: string;
  classSubjectId?: number;
}

export interface StudentOwnAssignmentFilters {
  dateFrom?: string;
  dateTo?: string;
  classSubjectId?: number;
  type?: 'CLASS_WORK' | 'HOME_WORK' | 'ASSIGNMENT';
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AssignmentsService {
  private base = 'school/assignments';

  constructor(private api: ApiService) {}

  // ── Utility ────────────────────────────────────────────────────────────────

  private toHttpParams(obj: Record<string, any>): HttpParams {
    let params = new HttpParams();
    Object.entries(obj).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  // ── Staff / Teacher view ───────────────────────────────────────────────────

  getAssignments(filters: AssignmentFilters = {}): Observable<EnrichedAssignment[]> {
    const params = this.toHttpParams(filters as Record<string, any>);
    return this.api.get<{ assignments: EnrichedAssignment[] }>(this.base, params).pipe(
      map((res) => res.assignments ?? []),
      catchError((err) => {
        console.error('Failed to load assignments', err);
        return throwError(() => err);
      })
    );
  }

  getById(id: number): Observable<EnrichedAssignment> {
    return this.api.get<{ assignment: EnrichedAssignment }>(`${this.base}/${id}`).pipe(
      map((res) => res.assignment),
      catchError((err) => throwError(() => err))
    );
  }

  createAssignment(data: CreateAssignmentPayload): Observable<any> {
    return this.api.post(this.base, data).pipe(catchError((err) => throwError(() => err)));
  }

  updateAssignment(id: number, data: Partial<CreateAssignmentPayload>): Observable<any> {
    return this.api
      .put(`${this.base}/${id}`, data)
      .pipe(catchError((err) => throwError(() => err)));
  }

  deleteAssignment(id: number): Observable<{ message: string }> {
    return this.api
      .delete<{ message: string }>(`${this.base}/${id}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ── Student view ───────────────────────────────────────────────────────────

  getStudentAssignments(filters: StudentAssignmentFilters = {}): Observable<EnrichedAssignment[]> {
    const params = this.toHttpParams(filters as Record<string, any>);
    return this.api.get<{ assignments: EnrichedAssignment[] }>(`${this.base}/student`, params).pipe(
      map((res) => res.assignments ?? []),
      catchError((err) => {
        console.error('Failed to load student assignments', err);
        return throwError(() => err);
      })
    );
  }

  studentSubmit(assignmentId: number): Observable<any> {
    return this.api
      .post(`${this.base}/submit`, { assignmentId })
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ── Grading / Submissions ─────────────────────────────────────────────────

  recordSubmissions(data: {
    assignmentId: number;
    submissions: Array<{
      enrollmentId: number;
      teacherStatus: string;
      marksObtained?: number | null;
      remarks?: string;
    }>;
  }): Observable<any> {
    return this.api
      .post(`${this.base}/submissions`, data)
      .pipe(catchError((err) => throwError(() => err)));
  }

  getSubmissionsReport(assignmentId: number): Observable<SubmissionsReport> {
    const params = new HttpParams().set('assignmentId', assignmentId.toString());
    return this.api
      .get<SubmissionsReport>(`${this.base}/report`, params)
      .pipe(catchError((err) => throwError(() => err)));
  }

  getSubmissionsByStudent(studentId: number, assignmentId?: number): Observable<any> {
    let params = new HttpParams().set('studentId', studentId.toString());
    if (assignmentId !== undefined) {
      params = params.set('assignmentId', assignmentId.toString());
    }
    return this.api
      .get(`${this.base}/submissions/student`, params)
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ── Student portal: view own assignments ─────────────────────────────────
  getMyAssignments(filters: StudentOwnAssignmentFilters = {}): Observable<EnrichedAssignment[]> {
    const params = this.toHttpParams(filters as Record<string, any>);
    return this.api
      .get<{ assignments: EnrichedAssignment[] }>(`${this.base}/student/my`, params)
      .pipe(
        map((res) => res.assignments ?? []),
        catchError((err) => {
          console.error('Failed to load student assignments', err);
          return throwError(() => err);
        })
      );
  }

  // ── Student portal: mark assignment as done ───────────────────────────────
  markMyAssignmentDone(assignmentId: number): Observable<{ message: string }> {
    return this.api
      .post<{ message: string }>(`${this.base}/student/submit`, { assignmentId })
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ── Parent portal: view child's assignments (child scoped by X-Active-Child-Id) ──
  getChildAssignments(filters: StudentOwnAssignmentFilters = {}): Observable<EnrichedAssignment[]> {
    const params = this.toHttpParams(filters as Record<string, any>);
    return this.api
      .get<{ assignments: EnrichedAssignment[] }>(`${this.base}/parent/child`, params)
      .pipe(
        map((res) => res.assignments ?? []),
        catchError((err) => {
          console.error('Failed to load child assignments', err);
          return throwError(() => err);
        })
      );
  }
}
