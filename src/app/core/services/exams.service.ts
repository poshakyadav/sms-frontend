// src/app/core/services/exams.service.ts

import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface TemplateMeta {
  key: string;
  name: string;
  description: string;
  thumbnail: 'classic' | 'modern' | 'minimal';
}

export interface CardTemplate extends TemplateMeta {
  htmlContent: string;
}

export interface TemplateConfig {
  activeKey: string;
  templates: TemplateMeta[];
}

export interface ExamTimetableEntry {
  classSubjectId: number;
  date: string;
  startTime?: string;
  endTime?: string;
  roomNumber?: string;
  maxMarks: number;
  passingMarks?: number;
  /** Optional override label — e.g. "English Paper One" */
  subjectLabel?: string | null;
  /** Resolved display name: subjectLabel if set, else the canonical subject name */
  subjectName?: string;
}

export type ExamStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';

export interface Exam {
  id: number;
  academicYearId: number;
  classSectionId: number;
  name: string;
  /** Free-text exam type — no longer constrained to a fixed enum */
  type: string;
  description?: string;
  timetable: ExamTimetableEntry[];
  className?: string;
  sectionName?: string;
  // ── Feature 2: lifecycle status ────────────────────────────────────────
  status: ExamStatus;
  // ── Feature 1: publication flags ───────────────────────────────────────
  admitCardPublished: boolean;
  reportCardPublished: boolean;
  admitCardPublishedAt?: string | null;
  reportCardPublishedAt?: string | null;
}

export interface MarkEntry {
  enrollmentId: number;
  marksObtained: number;
  grade?: string;
  remarks?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExamsService {
  private base = 'school/exams';

  constructor(private api: ApiService) {}

  private toParams(obj: Record<string, any> = {}): HttpParams {
    let params = new HttpParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== null && v !== undefined) params = params.set(k, String(v));
    });
    return params;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  getExams(): Observable<Exam[]> {
    return this.api.get<{ exams: Exam[] }>(this.base).pipe(map((r) => r.exams));
  }

  getById(id: number): Observable<Exam> {
    return this.api.get<{ exam: Exam }>(`${this.base}/${id}`).pipe(map((r) => r.exam));
  }

  createExam(data: any): Observable<any> {
    return this.api.post(this.base, data);
  }

  updateExam(id: number, data: any): Observable<any> {
    return this.api.put(`${this.base}/${id}`, data);
  }

  deleteExam(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/${id}`);
  }

  // ── Feature 2: Status management ─────────────────────────────────────────

  /**
   * Update the lifecycle status of an exam.
   * Requires exams.status.manage permission.
   */
  updateStatus(
    examId: number,
    status: ExamStatus
  ): Observable<{ message: string; exam: { id: number; status: ExamStatus } }> {
    return this.api.patch(`${this.base}/${examId}/status`, { status });
  }

  // ── Feature 1: Card publication ───────────────────────────────────────────

  /**
   * Publish or unpublish an admit card / report card for an exam.
   * Requires exams.admit-card.publish or exams.report-card.publish permission.
   */
  publishCard(
    examId: number,
    cardType: 'ADMIT_CARD' | 'REPORT_CARD',
    published: boolean
  ): Observable<{
    message: string;
    exam: { id: number; admitCardPublished: boolean; reportCardPublished: boolean };
  }> {
    return this.api.patch(`${this.base}/${examId}/publish`, { cardType, published });
  }

  // ── Marks ─────────────────────────────────────────────────────────────────

  enterMarks(data: {
    examId: number;
    classSubjectId: number;
    marks: MarkEntry[];
  }): Observable<any> {
    return this.api.post(`${this.base}/marks`, data);
  }

  getMarksByStudent(studentId: number, examId?: number): Observable<any> {
    let params = new HttpParams().set('studentId', studentId.toString());
    if (examId) params = params.set('examId', examId.toString());
    return this.api.get(`${this.base}/marks/student`, params);
  }

  // ── Staff card generation (no publication gate) ───────────────────────────

  getAdmitCard(examId: number, studentId: number): Observable<{ html: string }> {
    const params = new HttpParams()
      .set('examId', examId.toString())
      .set('studentId', studentId.toString());
    return this.api
      .get<{ admitCard: { html: string } }>(`${this.base}/admit-card`, params)
      .pipe(map((r) => r.admitCard));
  }

  getReportCard(examId: number, studentId: number): Observable<{ html: string }> {
    const params = new HttpParams()
      .set('examId', examId.toString())
      .set('studentId', studentId.toString());
    return this.api
      .get<{ reportCard: { html: string } }>(`${this.base}/report-card`, params)
      .pipe(map((r) => r.reportCard));
  }

  // ── Student own cards (publication-gated) ────────────────────────────────

  getStudentAdmitCard(examId: number): Observable<{ html: string }> {
    const params = new HttpParams().set('examId', examId.toString());
    return this.api
      .get<{ admitCard: { html: string } }>(`${this.base}/student/my/admit-card`, params)
      .pipe(map((r) => r.admitCard));
  }

  getStudentReportCard(examId: number): Observable<{ html: string }> {
    const params = new HttpParams().set('examId', examId.toString());
    return this.api
      .get<{ reportCard: { html: string } }>(`${this.base}/student/my/report-card`, params)
      .pipe(map((r) => r.reportCard));
  }

  // ── Parent child cards (publication-gated) ────────────────────────────────

  getParentChildAdmitCard(examId: number): Observable<{ html: string }> {
    const params = new HttpParams().set('examId', examId.toString());
    return this.api
      .get<{ admitCard: { html: string } }>(`${this.base}/parent/child/admit-card`, params)
      .pipe(map((r) => r.admitCard));
  }

  getParentChildReportCard(examId: number): Observable<{ html: string }> {
    const params = new HttpParams().set('examId', examId.toString());
    return this.api
      .get<{ reportCard: { html: string } }>(`${this.base}/parent/child/report-card`, params)
      .pipe(map((r) => r.reportCard));
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  getTemplateConfig(type: 'ADMIT_CARD' | 'REPORT_CARD'): Observable<TemplateConfig> {
    return this.api.get<TemplateConfig>(`${this.base}/templates/config/${type}`);
  }

  selectTemplate(data: {
    type: 'ADMIT_CARD' | 'REPORT_CARD';
    templateKey: string;
    name: string;
  }): Observable<any> {
    return this.api.post(`${this.base}/templates/select`, data);
  }

  getTemplateHtml(type: 'ADMIT_CARD' | 'REPORT_CARD', key: string): Observable<CardTemplate> {
    const params = new HttpParams().set('key', key);
    return this.api
      .get<{ template: CardTemplate }>(`${this.base}/templates/${type}`, params)
      .pipe(map((r) => r.template));
  }

  createOrUpdateTemplate(data: {
    type: 'ADMIT_CARD' | 'REPORT_CARD';
    name: string;
    htmlContent: string;
  }): Observable<any> {
    return this.api.post(`${this.base}/templates`, data);
  }

  getTemplate(type: 'ADMIT_CARD' | 'REPORT_CARD'): Observable<{ template: any }> {
    return this.api.get<{ template: any }>(`${this.base}/templates/${type}`);
  }
}
