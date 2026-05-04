import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AcademicsService } from './academics.service';

export interface AttendanceRecord {
  id: number;
  enrollmentId: number;
  studentId: number;
  date: string; // "2026-02-14"
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
  notes?: string;
  markedBy: number; // Teacher ID
  createdAt: string;
  updatedAt: string;
  studentName?: string;
  rollNumber?: string;
}

export interface AttendanceBatchInput {
  date: string; // YYYY-MM-DD
  classSectionId: number;
  attendances: Array<{
    studentId: number;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
    notes?: string;
  }>;
}

export interface AttendanceReportItem {
  studentId: number;
  studentName: string;
  rollNumber: string | null; 
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  attendancePercentage: number;
}

export interface EnrolledStudentForAttendance {
  id: number; // Student ID
  enrollmentId: number;
  name: string;
  rollNumber: string;
  status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  constructor(private api: ApiService, private academics: AcademicsService) {}

  markAttendanceBatch(data: AttendanceBatchInput): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('school/attendance', data);
  }

  getByStudent(
    studentId: number,
    fromDate: string,
    toDate: string
  ): Observable<{ attendance: AttendanceRecord[] }> {
    let params = new HttpParams()
      .set('studentId', studentId.toString())
      .set('fromDate', fromDate)
      .set('toDate', toDate);

    // FIXED: Pass params correctly to your ApiService.get()
    return this.api.get<{ attendance: AttendanceRecord[] }>('school/attendance/student', params);
  }

  getByClassSection(
    classSectionId: number,
    date: string
  ): Observable<{ attendance: AttendanceRecord[] }> {
    let params = new HttpParams()
      .set('classSectionId', classSectionId.toString())
      .set('date', date);

    return this.api.get<{ attendance: AttendanceRecord[] }>('school/attendance/class', params);
  }

  getReport(paramsInput: {
    classSectionId?: number;
    studentId?: number;
    month?: number;
    year?: number;
  }): Observable<{ report: AttendanceReportItem[] }> {
    let httpParams = new HttpParams();
    if (paramsInput.classSectionId)
      httpParams = httpParams.set('classSectionId', paramsInput.classSectionId.toString());
    if (paramsInput.studentId)
      httpParams = httpParams.set('studentId', paramsInput.studentId.toString());
    if (paramsInput.month) httpParams = httpParams.set('month', paramsInput.month.toString());
    if (paramsInput.year) httpParams = httpParams.set('year', paramsInput.year.toString());

    // FIXED: Pass params correctly
    return this.api.get<{ report: AttendanceReportItem[] }>('school/attendance/report', httpParams);
  }

  getEnrolledStudentsForMarking(
    classSectionId: number,
    date: string
  ): Observable<EnrolledStudentForAttendance[]> {
    return forkJoin({
      enrollments: this.academics.getEnrollments(),
      existingAttendance: this.getByClassSection(classSectionId, date),
    }).pipe(
      map(({ enrollments, existingAttendance }) => {
        const classEnrollments = enrollments.enrollments.filter(
          (e) => e.classSectionId === classSectionId && e.isActive
        );

        const students = classEnrollments.map((e) => ({
          id: e.studentId,
          enrollmentId: e.id,
          name: e.studentName || 'Unknown',
          rollNumber: e.rollNumber || '',
          status: 'PRESENT' as const,
          notes: '',
        }));

        const existingMap = new Map<
          number,
          { status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY'; notes?: string }
        >(
          existingAttendance.attendance.map((a) => [
            a.studentId,
            { status: a.status, notes: a.notes },
          ])
        );

        return students.map((s) => ({
          ...s,
          ...(existingMap.get(s.id) || {}),
        }));
      })
    );
  }
}
