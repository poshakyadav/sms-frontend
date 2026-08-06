// src/app/core/services/parent.service.ts
// Production-grade parent service with child switching + admin assignment APIs
//
//   Children are now persisted to localStorage under 'parentChildren' so the
//   switcher survives page refreshes. On service construction the signal is
//   pre-populated from storage BEFORE any component renders, so hasChildren()
//   is immediately true and the switcher shows without waiting for an API call.
//   SchoolLayout still calls loadChildren() on init to keep data fresh.

import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChildEnrollment {
  enrollmentId: number;
  className: string;
  sectionName: string;
  rollNumber?: string;
  academicYearName: string;
  isActive: boolean;
}

export interface ParentChild {
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentAvatarUrl?: string;
  relationship: string;
  isPrimary: boolean;
  currentEnrollment: ChildEnrollment | null;
}

export interface ChildDashboardData {
  enrollment: {
    enrollmentId: number;
    className: string;
    sectionName: string;
    rollNumber?: string;
    academicYearName: string;
    classSectionId: number;
    isActive: boolean;
  } | null;
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    attendancePercentage: number;
  } | null;
  fees: {
    totalDue: number;
    totalPaid: number;
    balance: number;
  } | null;
  pendingAssignments: number;
  recentGrades: Array<{
    examName: string;
    marksObtained: number;
    grade?: string;
    remarks?: string;
  }>;
  recentNotifications: Array<{
    id: number;
    title: string;
    message: string;
    createdAt: string;
  }>;
}

export interface ParentSearchResult {
  userId: number;
  name: string;
  email: string | null;
  phone: string;
  avatarUrl?: string;
  occupation?: string;
  linkedStudentCount: number;
}

// ── NEW: Student search result from the dedicated parent module endpoint ──────
export interface StudentSearchResult {
  id: number;
  name: string;
  email: string | null;
  avatarUrl?: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  primaryRole: string;
}

export interface StudentParentLink {
  linkId: number;
  parentUserId: number;
  parentName: string;
  parentEmail: string | null;
  parentPhone: string;
  parentAvatarUrl?: string;
  occupation?: string;
  relationship: string;
  isPrimary: boolean;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const ACTIVE_CHILD_KEY = 'activeChildId';
const CHILDREN_KEY = 'parentChildren'; // persists children list across refreshes

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ParentService {
  // ── Reactive state ─────────────────────────────────────────────────────────
  // Both signals are rehydrated from localStorage in the constructor so they
  // are truthy BEFORE any component's ngOnInit fires — this is the key fix.
  private _children = signal<ParentChild[]>(this.loadPersistedChildren());
  private _activeChildId = signal<number | null>(this.loadActiveChildId());
  private _loading = signal(false);

  readonly children = computed(() => this._children());
  readonly activeChildId = computed(() => this._activeChildId());
  readonly activeChild = computed(
    () => this._children().find((c) => c.studentId === this._activeChildId()) ?? null
  );
  readonly hasChildren = computed(() => this._children().length > 0);
  readonly isParentWithMultipleChildren = computed(() => this._children().length > 1);
  readonly loading = computed(() => this._loading());

  constructor(private api: ApiService) {}

  // ── Load children from API ─────────────────────────────────────────────────
  /**
   * Fetches fresh children from the backend.
   * Call this from SchoolLayout.ngOnInit() whenever the user is STUDENT_PARENT.
   * Because the signal is already populated from localStorage the UI won't
   * flash — it just silently updates when the response arrives.
   */
  loadChildren(): Observable<{ success: boolean; children: ParentChild[] }> {
    this._loading.set(true);
    return this.api
      .get<{ success: boolean; children: ParentChild[] }>('school/parent/children')
      .pipe(
        tap((res) => {
          const kids = res.children ?? [];
          this._setChildren(kids);
          this._autoSelectChild(kids);
          this._loading.set(false);
        }),
        catchError((err) => {
          this._loading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ── Set / switch active child ─────────────────────────────────────────────

  setActiveChild(studentId: number): void {
    this._activeChildId.set(studentId);
    try {
      localStorage.setItem(ACTIVE_CHILD_KEY, String(studentId));
    } catch {
      /* SSR */
    }
  }

  switchChild(studentId: number): void {
    const child = this._children().find((c) => c.studentId === studentId);
    if (!child) {
      console.warn(`[ParentService] Child ${studentId} not found in local list`);
      return;
    }
    this.setActiveChild(studentId);
  }

  // ── Child dashboard data ───────────────────────────────────────────────────

  getChildDashboard(studentId: number): Observable<{ success: boolean } & ChildDashboardData> {
    return this.api.get<{ success: boolean } & ChildDashboardData>(
      `school/parent/child/${studentId}/dashboard`
    );
  }

  // ── Init from login response ───────────────────────────────────────────────
  /**
   * Called immediately after a successful parent login (before navigation).
   * Persists children so the very first refresh after login also works.
   */
  initFromLoginResponse(children: ParentChild[]): void {
    const kids = children ?? [];
    this._setChildren(kids);
    this._autoSelectChild(kids);
  }

  // ── Admin APIs ────────────────────────────────────────────────────────────

  /**
   * Search parents by name, email, or phone.
   * Uses the dedicated parent module endpoint: GET /school/parent/search?q=...
   * Requires: users.list permission
   */
  searchParents(query: string): Observable<{ success: boolean; parents: ParentSearchResult[] }> {
    return this.api.get<{ success: boolean; parents: ParentSearchResult[] }>(
      `school/parent/search?q=${encodeURIComponent(query)}`
    );
  }

  /**
   * Search students by name or email.
   * Uses the dedicated parent module endpoint: GET /school/parent/search-students?q=...
   * Returns students enriched with their current enrollment (class + section + roll number).
   * Requires: users.list permission
   */
  searchStudents(query: string): Observable<{ success: boolean; students: StudentSearchResult[] }> {
    const params = new HttpParams().set('q', query);
    return this.api.get<{ success: boolean; students: StudentSearchResult[] }>(
      'school/parent/search-students',
      params
    );
  }

  getStudentParents(
    studentId: number
  ): Observable<{ success: boolean; parents: StudentParentLink[] }> {
    return this.api.get<{ success: boolean; parents: StudentParentLink[] }>(
      `school/parent/student/${studentId}/parents`
    );
  }

  assignParentToStudent(
    studentId: number,
    parentUserId: number,
    relationship: string,
    isPrimary: boolean
  ): Observable<{ success: boolean; message: string; linkId: number }> {
    return this.api.post(`school/parent/student/${studentId}/assign`, {
      parentUserId,
      relationship,
      isPrimary,
    });
  }

  updateParentStudentLink(
    studentId: number,
    parentUserId: number,
    data: { relationship?: string; isPrimary?: boolean }
  ): Observable<{ success: boolean; message: string }> {
    return this.api.put(`school/parent/student/${studentId}/parent/${parentUserId}`, data);
  }

  removeParentFromStudent(
    studentId: number,
    parentUserId: number
  ): Observable<{ success: boolean; message: string }> {
    return this.api.delete(`school/parent/student/${studentId}/parent/${parentUserId}`);
  }

  // ── Clear on logout ────────────────────────────────────────────────────────
  /**
   * Call from AuthService.clearAuth() on logout to wipe all parent state.
   */
  clear(): void {
    this._children.set([]);
    this._activeChildId.set(null);
    try {
      localStorage.removeItem(ACTIVE_CHILD_KEY);
      localStorage.removeItem(CHILDREN_KEY);
    } catch {
      /* SSR */
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Single point of truth for updating the children signal AND localStorage.
   * Always use this instead of calling _children.set() directly.
   */
  private _setChildren(children: ParentChild[]): void {
    this._children.set(children);
    try {
      localStorage.setItem(CHILDREN_KEY, JSON.stringify(children));
    } catch {
      /* storage quota / SSR */
    }
  }

  private _autoSelectChild(children: ParentChild[]): void {
    if (children.length === 0) return;
    const currentId = this._activeChildId();
    const stillExists = children.some((c) => c.studentId === currentId);
    if (!currentId || !stillExists) {
      const primary = children.find((c) => c.isPrimary) ?? children[0];
      if (primary) this.setActiveChild(primary.studentId);
    }
  }

  private loadActiveChildId(): number | null {
    try {
      const stored = localStorage.getItem(ACTIVE_CHILD_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Rehydrates the children list from localStorage at construction time.
   * Returns [] (never null/undefined) so computed signals are always safe.
   */
  private loadPersistedChildren(): ParentChild[] {
    try {
      const raw = localStorage.getItem(CHILDREN_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
