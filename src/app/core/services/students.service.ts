// students.service.ts

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface StudentInClassSection {
  id: number;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  isActive: boolean;
  rollNumber?: string;
  admissionDate?: string;
  previousSchool?: string;
  medicalInfo?: string;
  enrollmentId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  enrollmentDate?: string;
  academicYearId: number;
}

export interface StudentBasic {
  id: number;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  isActive: boolean;
  rollNumber?: string;
  admissionDate?: string;
  previousSchool?: string;
  medicalInfo?: string;
}

export interface StudentEnrollment {
  enrollmentId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  rollNumber?: string;
  enrollmentDate?: string;
  isActive: boolean;
}

export interface StudentParent {
  parentId: number;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  relationship: string;
  isPrimary: boolean;
  occupation?: string;
}

export interface StudentDetail extends StudentBasic {
  alternatePhone?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  createdAt?: string;
  enrollments: StudentEnrollment[];
  parents: StudentParent[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StudentsService {
  constructor(private api: ApiService) {}

  /**
   * Returns ALL students (active ones with active enrollment).
   * This calls GET /school/students which returns students with isActive=true.
   */
  /** All students — requires students.list permission */
  getStudents(): Observable<{ students: StudentBasic[] }> {
    return this.api.get<{ students: StudentBasic[] }>('school/students');
  }

  /** Single student with enrollments + parents */
  getStudentById(id: number): Observable<{ student: StudentDetail }> {
    return this.api.get<{ student: StudentDetail }>(`school/students/${id}`);
  }

  /** Students enrolled in a specific class-section (current year) */
  getStudentsByClassSection(
    classSectionId: number
  ): Observable<{ students: StudentInClassSection[] }> {
    return this.api.get<{ students: StudentInClassSection[] }>(
      `school/students/by-class-section?classSectionId=${classSectionId}`
    );
  }
}
