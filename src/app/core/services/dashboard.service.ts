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

export interface DashboardStats {
  // Owner / Management
  totalStudents?: number;
  totalTeachers?: number;
  totalStaff?: number;
  currentEnrollments?: number;
  feesCollected?: number;
  feesPending?: number;
  feeCollectionRate?: number;
  activeClassSections?: number;
 
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
  totalFeeDue?: number;
 
  // Allow any key (backend is dynamic)
  [key: string]: number | string | undefined;
}

export interface DashboardLists {
  recentNotifications?: DashboardNotification[];
  assignedClasses?: DashboardAssignedClass[];
  recentGrades?: DashboardGrade[];
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
    // ── GUARD: school API requires auth token stored in localStorage.
    // On the server there is no localStorage, so this call would go out
    // unauthenticated, get transfer-cached by Angular hydration, and the
    // browser would reuse that empty response instead of its own authenticated
    // request. Return EMPTY on the server so nothing is cached.
    if (!isPlatformBrowser(this.platformId)) {
      return EMPTY;
    }
    return this.api.get<DashboardData>('school/dashboard');
  }
}
