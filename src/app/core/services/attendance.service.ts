// attendance.service.ts
import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ─────────────────────────────────────────────────────────────────────────
// ATTENDANCE STATUS — mirrors backend src/db/schemas/school/school-attendances.ts
// Category groupings match PRESENT_EQUIVALENT / ABSENT_EQUIVALENT / NEUTRAL_STATUSES
// on the backend so the frontend's visual language stays in sync with the
// percentage-calculation logic.
// ─────────────────────────────────────────────────────────────────────────

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  ABSENT: 'ABSENT',
  SICK: 'SICK',
  SUSPENDED: 'SUSPENDED',
  EXCUSED: 'EXCUSED',
  HOLIDAY: 'HOLIDAY',
  ON_DUTY: 'ON_DUTY',
} as const;

export type AttendanceStatusValue = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const ALL_ATTENDANCE_STATUSES: AttendanceStatusValue[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.ABSENT,
  AttendanceStatus.SICK,
  AttendanceStatus.SUSPENDED,
  AttendanceStatus.EXCUSED,
  AttendanceStatus.HOLIDAY,
  AttendanceStatus.ON_DUTY,
];

export const HalfDaySession = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
} as const;
export type HalfDaySessionValue = (typeof HalfDaySession)[keyof typeof HalfDaySession];

export type AttendanceCategory = 'present' | 'absent' | 'neutral';

export interface AttendanceStatusConfig {
  value: AttendanceStatusValue;
  label: string;
  icon: string;
  category: AttendanceCategory;
  notesPlaceholder?: string;
}

// Single source of truth the component/template pulls labels, icons, and
// colour-category from — keeps the UI declarative instead of switch-statements.
export const ATTENDANCE_STATUS_CONFIG: Record<AttendanceStatusValue, AttendanceStatusConfig> = {
  PRESENT: { value: 'PRESENT', label: 'Present', icon: 'check_circle', category: 'present' },
  LATE: { value: 'LATE', label: 'Late', icon: 'schedule', category: 'present' },
  HALF_DAY: { value: 'HALF_DAY', label: 'Half Day', icon: 'brightness_medium', category: 'present' },
  ABSENT: { value: 'ABSENT', label: 'Absent', icon: 'cancel', category: 'absent' },
  SICK: {
    value: 'SICK',
    label: 'Sick',
    icon: 'sick',
    category: 'absent',
    notesPlaceholder: 'Medical certificate / doctor note…',
  },
  SUSPENDED: {
    value: 'SUSPENDED',
    label: 'Suspended',
    icon: 'block',
    category: 'absent',
    notesPlaceholder: 'Suspension order reference…',
  },
  EXCUSED: {
    value: 'EXCUSED',
    label: 'Excused',
    icon: 'event_available',
    category: 'neutral',
    notesPlaceholder: 'Approval note / event name…',
  },
  HOLIDAY: { value: 'HOLIDAY', label: 'Holiday', icon: 'beach_access', category: 'neutral' },
  ON_DUTY: {
    value: 'ON_DUTY',
    label: 'On Duty',
    icon: 'military_tech',
    category: 'neutral',
    notesPlaceholder: 'Activity name (e.g. District Science Olympiad)…',
  },
};

// ── Existing types kept (additive changes only, so getByStudent / getReport
// consumers elsewhere in the app keep compiling) ───────────────────────────

export interface AttendanceRecord {
  id: number;
  enrollmentId: number;
  studentId: number;
  date: string;
  status: AttendanceStatusValue;
  halfDaySession?: HalfDaySessionValue | null;
  notes?: string | null;
  markedBy: number;
  createdAt: string;
  updatedAt: string;
  studentName?: string;
  rollNumber?: string;
}

export interface AttendanceBatchInput {
  date: string;
  classSectionId: number;
  attendances: Array<{
    studentId: number;
    status: AttendanceStatusValue;
    halfDaySession?: HalfDaySessionValue; // must be omitted unless status = HALF_DAY (backend enforces via superRefine)
    notes?: string;
  }>;
}

export interface AttendanceReportItem {
  studentId: number;
  studentName: string;
  rollNumber: string | null;
  totalDaysInMonth: number;
  totalMarkedDays: number;
  workingDays: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  sick: number;
  suspended: number;
  excused: number;
  holiday: number;
  onDuty: number;
  effectivePresent: number;
  attendancePercentage: number;
}

// ── NEW: matches getAttendanceByClassSection's response exactly ───────────

export interface ClassAttendanceRecordDetail {
  id: number;
  status: AttendanceStatusValue;
  halfDaySession: HalfDaySessionValue | null;
  notes: string | null;
  markedBy: number;
  markedByName: string;
  updatedAt: string;
}

export interface ClassAttendanceStudentRow {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  rollNumber: string | null;
  avatarUrl: string | null;
  attendanceRecord: ClassAttendanceRecordDetail | null; // null = not yet marked for this date
}

export interface ClassAttendanceSessionMeta {
  date: string;
  classSectionId: number;
  isFullyMarked: boolean;
  isPartiallyMarked: boolean;
  markedCount: number;
  totalCount: number;
  lastMarkedBy: { userId: number; name: string } | null;
  lastUpdatedAt: string | null;
}

export interface ClassAttendanceResponse {
  session: ClassAttendanceSessionMeta;
  students: ClassAttendanceStudentRow[];
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private api: ApiService) { }

  markAttendanceBatch(
    data: AttendanceBatchInput
  ): Observable<{ message: string; new: number; updated: number }> {
    return this.api.post('school/attendance', data);
  }

  getByStudent(
    studentId: number,
    fromDate: string,
    toDate: string
  ): Observable<{ attendance: AttendanceRecord[] }> {
    const params = new HttpParams()
      .set('studentId', studentId.toString())
      .set('fromDate', fromDate)
      .set('toDate', toDate);
    return this.api.get('school/attendance/student', params);
  }

  /**
   * Class sheet for a date — ONE round trip.
   * Replaces the old getEnrolledStudentsForMarking() forkJoin, since the
   * backend now returns every active enrollment (with attendanceRecord: null
   * for unmarked students) plus session-level metadata in a single query.
   */
  getByClassSection(classSectionId: number, date: string): Observable<ClassAttendanceResponse> {
    const params = new HttpParams()
      .set('classSectionId', classSectionId.toString())
      .set('date', date);
    return this.api.get<ClassAttendanceResponse>('school/attendance/class', params);
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
    return this.api.get('school/attendance/report', httpParams);
  }
}