// dashboard.service.ts

import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { isPlatformBrowser } from '@angular/common';

// ── Types matching backend response ──────────────────────────────────────────

export type DashboardPersona =
  | 'OWNER'
  | 'MANAGEMENT'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT'
  | 'GENERAL_STAFF';

export interface DashboardNotification {
  id: number;
  title: string;
  message: string;
  createdAt: string;
}

export interface DashboardAssignedClass {
  className: string;
  sectionName: string;
  subjectName: string;
  classSectionId: number;
  teacherAssignmentId: number;
  isPrimary: boolean;
}

export interface DashboardGrade {
  examName: string;
  marksObtained: number;
  grade?: string;
  remarks?: string;
}

// ── NEW: One row per active class-section (OWNER / MANAGEMENT only) ───────────
// Mirrors the AttendanceCoverageItem interface in backend services.ts.
// Built server-side with a single LEFT JOIN — never N+1.
export interface AttendanceCoverageItem {
  classSectionId: number;
  className: string;
  sectionName: string;
  /** True when ≥ 1 attendance record exists for today's date in this section. */
  isMarked: boolean;
  /** Number of student records entered today (for "X students marked" label). */
  markedCount: number;
  /** Total active enrollments (for "X / Y" completion display). */
  totalEnrolled: number;
}

export interface DashboardStats {
  // Owner / Management — core counts
  totalStudents?: number;
  totalTeachers?: number;
  totalStaff?: number;
  currentEnrollments?: number;
  activeClassSections?: number;

  // ── OWNER / MANAGEMENT: attendance summary (shown as a stat chip) ──────────
  // "sectionsMarkedToday / totalActiveSections" renders as "8 / 12 Sections"
  sectionsMarkedToday?: number;
  totalActiveSections?: number;

  // NOTE: feesCollected / feesPending / feeCollectionRate are intentionally
  // absent for OWNER — they are shown on the dedicated /school/fees/dashboard.

  // Teacher
  attendancesMarkedToday?: number;
  pendingSubmissions?: number;

  // Student / Parent shared
  myClass?: string;
  mySection?: string;
  rollNumber?: string;
  attendancePercentage?: number;
  totalDaysTracked?: number;
  pendingAssignments?: number;

  // Parent — child identity
  childName?: string;
  childAvatarUrl?: string;
  childGender?: string;
  childBloodGroup?: string;
  childAdmissionDate?: string;
  childMedicalInfo?: string;

  // Parent — attendance breakdown
  presentDays?: number;
  absentDays?: number;

  // Parent — fees

  feesCollected?: number;   
  feesPending?: number; 
  totalFeeDue?: number;

  // Allow any key (backend is dynamic)
  [key: string]: number | string | undefined;
}

export interface DashboardLists {
  recentNotifications?: DashboardNotification[];
  assignedClasses?: DashboardAssignedClass[];
  recentGrades?: DashboardGrade[];
  // ── NEW: per-section coverage list (OWNER / MANAGEMENT only) ──────────────
  attendanceCoverage?: AttendanceCoverageItem[];
  [key: string]: any[] | undefined;
}

export interface DashboardData {
  persona: DashboardPersona;
  stats: DashboardStats;
  lists: DashboardLists;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) {}

  private platformId = inject(PLATFORM_ID);

  getDashboard(): Observable<DashboardData> {
    // SSR guard — school API requires auth token in localStorage.
    // Return EMPTY on the server so nothing is transfer-cached unauthenticated.
    if (!isPlatformBrowser(this.platformId)) {
      return EMPTY;
    }
    return this.api.get<DashboardData>('school/dashboard');
  }
}
