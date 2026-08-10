// attendance.service.ts
import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ─────────────────────────────────────────────────────────────────────────
// ATTENDANCE STATUS
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
  AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY,
  AttendanceStatus.ABSENT, AttendanceStatus.SICK, AttendanceStatus.SUSPENDED,
  AttendanceStatus.EXCUSED, AttendanceStatus.HOLIDAY, AttendanceStatus.ON_DUTY,
];

// HOLIDAY is retired as a PER-STUDENT status — the backend rejects it and
// the calendar system is the only way to mark a day off now. This is the
// list the mark-attendance dropdown/bulk-actions should offer; ALL_ATTENDANCE_STATUSES
// stays complete for rendering historical records that might still carry it.
export const MARKABLE_ATTENDANCE_STATUSES: AttendanceStatusValue[] = ALL_ATTENDANCE_STATUSES.filter(
  (s) => s !== AttendanceStatus.HOLIDAY
);

export const HalfDaySession = { MORNING: 'MORNING', AFTERNOON: 'AFTERNOON' } as const;
export type HalfDaySessionValue = (typeof HalfDaySession)[keyof typeof HalfDaySession];

export type AttendanceCategory = 'present' | 'absent' | 'neutral';

export interface AttendanceStatusConfig {
  value: AttendanceStatusValue;
  label: string;
  icon: string;
  category: AttendanceCategory;
  notesPlaceholder?: string;
}

export const ATTENDANCE_STATUS_CONFIG: Record<AttendanceStatusValue, AttendanceStatusConfig> = {
  PRESENT: { value: 'PRESENT', label: 'Present', icon: 'check_circle', category: 'present' },
  LATE: { value: 'LATE', label: 'Late', icon: 'schedule', category: 'present' },
  HALF_DAY: { value: 'HALF_DAY', label: 'Half Day', icon: 'brightness_medium', category: 'present' },
  ABSENT: { value: 'ABSENT', label: 'Absent', icon: 'cancel', category: 'absent' },
  SICK: { value: 'SICK', label: 'Sick', icon: 'sick', category: 'absent', notesPlaceholder: 'Medical certificate / doctor note…' },
  SUSPENDED: { value: 'SUSPENDED', label: 'Suspended', icon: 'block', category: 'absent', notesPlaceholder: 'Suspension order reference…' },
  EXCUSED: { value: 'EXCUSED', label: 'Excused', icon: 'event_available', category: 'neutral', notesPlaceholder: 'Approval note / event name…' },
  HOLIDAY: { value: 'HOLIDAY', label: 'Holiday', icon: 'beach_access', category: 'neutral' },
  ON_DUTY: { value: 'ON_DUTY', label: 'On Duty', icon: 'military_tech', category: 'neutral', notesPlaceholder: 'Activity name…' },
};

// ─────────────────────────────────────────────────────────────────────────
// CALENDAR TYPES — mirrors backend calendar-service.ts
// ─────────────────────────────────────────────────────────────────────────

export type CalendarDayTypeValue = 'WORKING_DAY' | 'HOLIDAY';

export type CalendarResolutionSource =
  | 'CLASS_SECTION_OVERRIDE'
  | 'SCHOOL_WIDE'
  | 'WEEKLY_OFF'
  | 'DEFAULT_UNMARKED';

export interface CalendarCheckResult {
  date: string;
  classSectionId: number;
  dayType: CalendarDayTypeValue;
  source: CalendarResolutionSource;
  reason: string | null;
  isExplicit: boolean;
  calendarEntryId: number | null;
  isSessionMarked: boolean;
  sessionTotalStudents: number | null;
  sessionExceptionCount: number | null;
  canMarkAttendance: boolean;
  requiresCalendarAction: boolean;
}

export interface CalendarEntry {
  id: number;
  classSectionId: number;
  date: string;
  dayType: CalendarDayTypeValue;
  reason: string;
  createdBy: number;
  createdAt: string;
  createdByName: string;
  className: string | null;
  sectionName: string | null;
  scopeLabel: string;
}

export interface HolidayImpactPreview {
  scope: 'SCHOOL_WIDE' | 'CLASS_SECTION';
  classSectionId: number | null;
  fromDate: string;
  toDate: string;
  affectedDates: string[];
  count: number;
}

export interface DeclareCalendarPayload {
  fromDate: string;
  toDate: string;
  classSectionId?: number; // omit = school-wide
  reason?: string;
}

export interface DeclareHolidayResult {
  message: string;
  count: number;
  existingAttendanceWarning: string | null;
  affectedDates: string[];
}

export interface SetWorkingDayResult {
  message: string;
  count: number;
}

export interface MissingAttendanceDate {
  date: string;
  classSectionId: number;
  className: string;
}

// ─────────────────────────────────────────────────────────────────────────
// RECORD / SUMMARY TYPES
// ─────────────────────────────────────────────────────────────────────────

export type ReconstructedStatus = AttendanceStatusValue | 'UNMARKED';

export interface ReconstructedAttendanceRecord {
  id: number | null;
  date: string;
  status: ReconstructedStatus;
  halfDaySession: HalfDaySessionValue | null;
  notes: string | null;
  createdAt: string | null;
  isImplicit: boolean;
  isHoliday: boolean;
}

export interface AttendanceBatchInput {
  date: string;
  classSectionId: number;
  attendances: Array<{
    studentId: number;
    status: AttendanceStatusValue; // must not be HOLIDAY — backend rejects it
    halfDaySession?: HalfDaySessionValue;
    notes?: string;
  }>;
}

export interface MarkAttendanceResult {
  message: string;
  inserted: number;
  updated: number;
  cleared: number;
  unchanged: number;
}

export interface AttendanceSummary {
  month: number;
  year: number;
  workingDays: number;
  markedDays: number;
  unmarkedDays: number;
  present: number; late: number; halfDay: number; absent: number;
  sick: number; suspended: number; excused: number; holiday: number; onDuty: number;
  effectivePresent: number;
  attendancePercentage: number;
  totalDaysInMonth?: number;
}

export interface AttendanceReportItem {
  studentId: number;
  studentName: string;
  rollNumber: string | null;
  classSectionId: number;
  totalDaysInMonth: number;
  workingDays: number;
  markedDays: number;
  unmarkedDays: number;
  present: number; late: number; halfDay: number; absent: number;
  sick: number; suspended: number; excused: number; holiday: number; onDuty: number;
  effectivePresent: number;
  attendancePercentage: number;
}

export interface AttendanceAuditLogEntry {
  id: number;
  date: string;
  oldStatus: AttendanceStatusValue | null;
  newStatus: AttendanceStatusValue | null;
  changedAt: string;
  changedByName: string;
}

// ── Class-sheet (mark attendance) types — matches getAttendanceByClassSection ──

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
  attendanceRecord: ClassAttendanceRecordDetail | null;
}

export interface ClassAttendanceSessionMeta {
  date: string;
  classSectionId: number;
  dayType: CalendarDayTypeValue;
  isHoliday: boolean;
  isMarked: boolean;
  totalCount: number;
  exceptionCount: number;
  markedBy: { userId: number; name: string } | null;
  markedAt: string | null;
  lastEditedBy: { userId: number; name: string } | null;
  lastEditedAt: string | null;
}

export interface ClassAttendanceResponse {
  session: ClassAttendanceSessionMeta;
  students: ClassAttendanceStudentRow[];
}

// ─────────────────────────────────────────────────────────────────────────
// RECONSTRUCTED-RECORD DISPLAY HELPER
// 'UNMARKED' only exists on reconstructed history records (never a real,
// markable status), so it lives outside ATTENDANCE_STATUS_CONFIG. This is
// the one place that maps a full ReconstructedStatus -> display info, so
// student/parent views (and anything else reading history) stay in sync.
// ─────────────────────────────────────────────────────────────────────────

export interface ReconstructedStatusDisplay {
  label: string;
  icon: string;
  category: AttendanceCategory | 'unmarked';
}

const UNMARKED_STATUS_DISPLAY: ReconstructedStatusDisplay = {
  label: 'Not Marked',
  icon: 'help_outline',
  category: 'unmarked',
};

export function getReconstructedStatusDisplay(status: ReconstructedStatus): ReconstructedStatusDisplay {
  if (status === 'UNMARKED') return UNMARKED_STATUS_DISPLAY;
  const cfg = ATTENDANCE_STATUS_CONFIG[status];
  return { label: cfg.label, icon: cfg.icon, category: cfg.category };
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private api: ApiService) { }

  // ── Marking ────────────────────────────────────────────────────────────

  markAttendanceBatch(data: AttendanceBatchInput): Observable<MarkAttendanceResult> {
    return this.api.post('school/attendance', data);
  }

  getByClassSection(classSectionId: number, date: string): Observable<ClassAttendanceResponse> {
    const params = new HttpParams().set('classSectionId', classSectionId.toString()).set('date', date);
    return this.api.get('school/attendance/class', params);
  }

  // ── History views ─────────────────────────────────────────────────────

  getByStudent(studentId: number, fromDate: string, toDate: string): Observable<{ attendance: ReconstructedAttendanceRecord[] }> {
    const params = new HttpParams().set('studentId', studentId.toString()).set('fromDate', fromDate).set('toDate', toDate);
    return this.api.get('school/attendance/student', params);
  }

  getBySelf(fromDate: string, toDate: string): Observable<{ attendance: ReconstructedAttendanceRecord[] }> {
    const params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    return this.api.get('school/attendance/me', params);
  }

  getSelfSummary(month: number, year: number): Observable<{ summary: AttendanceSummary }> {
    const params = new HttpParams().set('month', month.toString()).set('year', year.toString());
    return this.api.get('school/attendance/me/summary', params);
  }

  getForChild(fromDate: string, toDate: string): Observable<{ attendance: ReconstructedAttendanceRecord[] }> {
    const params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    return this.api.get('school/attendance/child', params);
  }

  getChildSummary(month: number, year: number): Observable<{ summary: AttendanceSummary }> {
    const params = new HttpParams().set('month', month.toString()).set('year', year.toString());
    return this.api.get('school/attendance/child/summary', params);
  }

  getAuditLog(studentId: number, fromDate: string, toDate: string): Observable<{ log: AttendanceAuditLogEntry[] }> {
    const params = new HttpParams().set('studentId', studentId.toString()).set('fromDate', fromDate).set('toDate', toDate);
    return this.api.get('school/attendance/audit', params);
  }

  getReport(paramsInput: { classSectionId?: number; month?: number; year?: number }): Observable<{ report: AttendanceReportItem[] }> {
    let httpParams = new HttpParams();
    if (paramsInput.classSectionId) httpParams = httpParams.set('classSectionId', paramsInput.classSectionId.toString());
    if (paramsInput.month) httpParams = httpParams.set('month', paramsInput.month.toString());
    if (paramsInput.year) httpParams = httpParams.set('year', paramsInput.year.toString());
    return this.api.get('school/attendance/report', httpParams);
  }

  // ── Calendar ──────────────────────────────────────────────────────────

  checkCalendarStatus(classSectionId: number, date: string): Observable<CalendarCheckResult> {
    const params = new HttpParams().set('classSectionId', classSectionId.toString()).set('date', date);
    return this.api.get('school/attendance/calendar/check', params);
  }

  getCalendarEntries(fromDate: string, toDate: string, classSectionId?: number): Observable<{ entries: CalendarEntry[] }> {
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (classSectionId) params = params.set('classSectionId', classSectionId.toString());
    return this.api.get('school/attendance/calendar', params);
  }

  declareHoliday(payload: DeclareCalendarPayload): Observable<DeclareHolidayResult> {
    return this.api.post('school/attendance/calendar/holiday', payload);
  }

  setWorkingDayOverride(payload: DeclareCalendarPayload): Observable<SetWorkingDayResult> {
    return this.api.post('school/attendance/calendar/working-day', payload);
  }

  removeCalendarOverride(id: number): Observable<{ message: string }> {
    return this.api.delete(`school/attendance/calendar/${id}`);
  }

  previewHolidayImpact(fromDate: string, toDate: string, classSectionId?: number): Observable<HolidayImpactPreview> {
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (classSectionId) params = params.set('classSectionId', classSectionId.toString());
    return this.api.get('school/attendance/calendar/holiday-impact', params);
  }

  getMissingAttendance(fromDate: string, toDate: string, classSectionId?: number): Observable<{ missing: MissingAttendanceDate[] }> {
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (classSectionId) params = params.set('classSectionId', classSectionId.toString());
    return this.api.get('school/attendance/missing', params);
  }

  getWeeklyOffDays(): Observable<{ weeklyOffDays: number[] }> {
    return this.api.get('school/attendance/calendar/weekly-off');
  }

  setWeeklyOffDays(days: number[]): Observable<{ weeklyOffDays: number[] }> {
    return this.api.put('school/attendance/calendar/weekly-off', { days });
  }
}