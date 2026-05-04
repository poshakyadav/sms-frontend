// academics.service.ts

import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AcademicYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Class {
  id: number;
  name: string;
  level: number;
  sort_order: number;
}

export interface Section {
  id: number;
  name: string;
}

export interface ClassSection {
  id: number;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  capacity: number;
  classTeacherId?: number | null;
  classTeacherName?: string | null;
  roomNumber?: string | null;
  isActive: boolean;
  currentStudents?: number;
}

export interface EnrollmentInput {
  studentId: number;
  classSectionId: number;
  rollNumber?: string;
}

export interface Enrollment {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  academicYearId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  rollNumber?: string;
  enrollmentDate?: string;
  isActive: boolean;
}

export interface Student {
  id: number;
  name: string;
  email?: string;
  dateOfBirth?: string;
  admissionDate?: string;
}

export interface ClassSectionMapping {
  id: number;
  currentClassSectionId: number;
  currentDisplayName: string;
  nextClassSectionId: number;
  nextDisplayName: string;
  academicYearId?: number | null;
  academicYearName?: string | null;
  isGlobal: boolean;
}

export interface BulkMappingInput {
  currentClassSectionId: number;
  nextClassSectionId: number;
  // null = global mapping, number = year-specific
  academicYearId?: number | null;
}

// ── Unenrollment Types ────────────────────────────────────────────────────────

export type UnenrollmentType = 'TEMPORARY' | 'PERMANENT';

export interface EnrollmentStatus {
  success: boolean;
  isEnrolled: boolean;
  student: {
    id: number;
    name: string;
    email: string;
    isUserActive: boolean;
  } | null;
  enrollment: {
    id: number;
    className: string;
    sectionName: string;
    rollNumber: string | null;
    enrollmentDate: string | null;
    classSectionId: number;
  } | null;
  pendingFees: {
    totalDue: number;
    totalPaid: number;
    pendingAmount: number;
    hasPendingFees: boolean;
    mandatoryFeeCount: number;
  } | null;
  recordCounts: {
    attendanceRecords: number;
    examMarkRecords: number;
    enrollmentHistory: number;
  } | null;
}

export interface UnenrollInput {
  studentId: number;
  unenrollmentType: UnenrollmentType;
  reason: string;
  acknowledgePendingFees?: boolean;
}

export interface UnenrollResult {
  success: boolean;
  message: string;
  audit: {
    studentId: number;
    studentName: string;
    enrollmentId: number;
    fromClass: string;
    fromRollNumber: string | null;
    unenrollmentType: UnenrollmentType;
    reason: string;
    performedAt: string;
    performedBy: number;
    userAccountDeactivated: boolean;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AcademicsService {
  constructor(private api: ApiService) {}

  // ── Academic Years ─────────────────────────────────────────────────────────

  getAcademicYears(): Observable<{ years: AcademicYear[] }> {
    return this.api.get<{ years: AcademicYear[] }>('school/academics/years');
  }

  getAcademicYearById(id: number): Observable<AcademicYear> {
    return this.getAcademicYears().pipe(
      map((res) => {
        const year = res.years.find((y) => y.id === id);
        if (!year) throw new Error('Academic year not found');
        return year;
      })
    );
  }

  createAcademicYear(data: Partial<AcademicYear>): Observable<any> {
    return this.api.post('school/academics/years', data);
  }

  updateAcademicYear(id: number, data: Partial<AcademicYear>): Observable<any> {
    return this.api.put(`school/academics/years/${id}`, data);
  }

  deleteAcademicYear(id: number): Observable<any> {
    return this.api.delete(`school/academics/years/${id}`);
  }

  activateAcademicYear(id: number): Observable<{ year: AcademicYear; message: string }> {
    return this.api.patch<{ year: AcademicYear; message: string }>(
      `school/academics/years/${id}/activate`,
      {}
    );
  }

  promoteStudents(): Observable<any> {
    return this.api.post('school/academics/promote-students', {});
  }

  // ── Classes ────────────────────────────────────────────────────────────────

  getClasses(): Observable<{ classes: Class[] }> {
    return this.api.get<{ classes: Class[] }>('school/academics/classes');
  }

  createClass(data: Partial<Class>): Observable<{ class: Class }> {
    return this.api.post<{ class: Class }>('school/academics/classes', data);
  }

  updateClass(id: number, data: Partial<Class>): Observable<{ class: Class }> {
    return this.api.put<{ class: Class }>(`school/academics/classes/${id}`, data);
  }

  deleteClass(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`school/academics/classes/${id}`);
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  getSections(): Observable<{ sections: Section[] }> {
    return this.api.get<{ sections: Section[] }>('school/academics/sections');
  }

  createSection(data: Partial<Section>): Observable<{ section: Section }> {
    return this.api.post<{ section: Section }>('school/academics/sections', data);
  }

  updateSection(id: number, data: Partial<Section>): Observable<{ section: Section }> {
    return this.api.put<{ section: Section }>(`school/academics/sections/${id}`, data);
  }

  deleteSection(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`school/academics/sections/${id}`);
  }

  // ── Class-Sections ─────────────────────────────────────────────────────────

  getClassSections(): Observable<{ classSections: ClassSection[] }> {
    return this.api.get<{ classSections: ClassSection[] }>('school/academics/class-sections');
  }

  createClassSection(data: Partial<ClassSection>): Observable<{ classSection: ClassSection }> {
    return this.api.post<{ classSection: ClassSection }>('school/academics/class-sections', data);
  }

  updateClassSection(
    id: number,
    data: Partial<ClassSection>
  ): Observable<{ classSection: ClassSection }> {
    return this.api.put<{ classSection: ClassSection }>(
      `school/academics/class-sections/${id}`,
      data
    );
  }

  // ── Was missing — caused TS error in class-sections-list ──────────────────
  deleteClassSection(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`school/academics/class-sections/${id}`);
  }

  getAvailableClassSections(): Observable<{ available: ClassSection[] }> {
    return this.api.get<{ available: ClassSection[] }>('school/academics/class-sections/available');
  }

  // ── Enrollments ────────────────────────────────────────────────────────────

  enrollStudent(data: EnrollmentInput): Observable<any> {
    return this.api.post('school/academics/enroll-student', data);
  }

  getEnrollments(): Observable<{ enrollments: Enrollment[] }> {
    return this.api.get<{ enrollments: Enrollment[] }>('school/academics/enrollments');
  }

  getUnenrolledStudents(): Observable<{ students: Student[] }> {
    return this.api.get<{ students: Student[] }>('school/academics/unenrolled-students');
  }

  moveStudent(data: {
    studentId: number;
    targetClassSectionId: number;
    targetRollNumber?: string | null;
    notes?: string;
  }): Observable<any> {
    return this.api.post('school/academics/move-student', data);
  }

  assignRollNumbers(data: {
    classSectionId: number;
    orderBy: 'name' | 'admissionDate';
  }): Observable<any> {
    return this.api.post('school/academics/assign-roll-numbers', data);
  }

  // ── Unenrollment ───────────────────────────────────────────────────────────

  /**
   * Pre-flight check — call before showing the unenrollment form.
   * Returns enrollment details, pending fees, and record counts.
   */
  getEnrollmentStatus(studentId: number): Observable<EnrollmentStatus> {
    return this.api.get<EnrollmentStatus>(`school/academics/enrollment-status/${studentId}`);
  }

  /**
   * Performs the actual unenrollment transaction.
   * If student has pending fees and acknowledgePendingFees is false,
   * the backend returns 409 with fee details.
   */
  unenrollStudent(data: UnenrollInput): Observable<UnenrollResult> {
    return this.api.post<UnenrollResult>('school/academics/unenroll-student', data);
  }

  getPermanentlyUnenrolledStudents(): Observable<{ students: any[] }> {
    return this.api.get<{ students: any[] }>('school/academics/permanently-unenrolled-students');
  }

  // ── Teachers ───────────────────────────────────────────────────────────────

  getTeachers(): Observable<{ teachers: any[] }> {
    return this.api.get<{ teachers: any[] }>('school/academics/teachers');
  }

  // ── Class-Section Mappings ─────────────────────────────────────────────────

  /**
   *
   * @param scope
   *   'all'    → all mappings (default)
   *   'global' → only global mappings (no year attached)
   *   number   → only mappings for that academic year ID
   */
  getClassSectionMappings(
    scope: 'all' | 'global' | number = 'all'
  ): Observable<{ mappings: ClassSectionMapping[]; scope: string }> {
    let params = new HttpParams();

    if (scope === 'global') {
      params = params.set('scope', 'global');
    } else if (typeof scope === 'number') {
      params = params.set('scope', 'year').set('yearId', scope.toString());
    } else {
      params = params.set('scope', 'all');
    }

    return this.api.get<{ mappings: ClassSectionMapping[]; scope: string }>(
      'school/academics/mappings',
      params
    );
  }

  createMapping(data: BulkMappingInput): Observable<any> {
    return this.api.post('school/academics/mappings', data);
  }

  createBulkMappings(data: BulkMappingInput[]): Observable<any> {
    return this.api.post('school/academics/mappings/bulk', data);
  }

  updateMapping(id: number, data: Partial<BulkMappingInput>): Observable<any> {
    return this.api.put(`school/academics/mappings/${id}`, data);
  }

  deleteMapping(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`school/academics/mappings/${id}`);
  }

  /**
   * Bulk-promote a selection of students.
   *
   * - useMapping: true  → each student is moved to their next class-section
   *                       per configured mappings
   * - targetClassSectionId → all students are moved to this specific section
   */
  bulkPromoteStudents(data: {
    studentIds: number[];
    targetClassSectionId?: number | null;
    useMapping: boolean;
  }): Observable<{
    message: string;
    successCount: number;
    failCount: number;
    results: Array<{
      studentId: number;
      studentName: string;
      success: boolean;
      oldClassSection?: string;
      newClassSection?: string;
      error?: string;
    }>;
  }> {
    return this.api.post('school/academics/promote-bulk', data);
  }
}
