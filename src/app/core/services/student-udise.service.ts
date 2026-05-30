// src/app/core/services/student-udise.service.ts

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── UDISE Enum Types (re-exported for components) ─────────────────────────────

export type EnrollmentType = 'REGULAR' | 'PRIVATE' | 'OPEN_SCHOOL';
export type PreviousClassResult = 'PROMOTED' | 'NOT_PROMOTED' | 'NEW_ADMISSION' | 'TRANSFERRED';
export type LocalityType = 'URBAN' | 'RURAL';
export type SocialCategory = 1 | 2 | 3 | 4 | 5;
export type Religion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type DisabilityType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type FacilityReceived =
  | 'FREE_TEXTBOOKS'
  | 'FREE_UNIFORM'
  | 'FREE_TRANSPORT'
  | 'FREE_BICYCLE'
  | 'SCHOLARSHIP'
  | 'MID_DAY_MEAL'
  | 'FREE_STATIONERY'
  | 'OTHERS';

// ── Label Maps ────────────────────────────────────────────────────────────────

export const SOCIAL_CATEGORY_LABELS: Record<number, string> = {
  1: 'General',
  2: 'SC (Scheduled Caste)',
  3: 'ST (Scheduled Tribe)',
  4: 'OBC (Other Backward Class)',
  5: 'OBC-NCL (Non Creamy Layer)',
};

export const RELIGION_LABELS: Record<number, string> = {
  1: 'Hindu',
  2: 'Muslim',
  3: 'Christian',
  4: 'Sikh',
  5: 'Buddhist',
  6: 'Jain',
  7: 'Others',
  8: 'No Religion',
};

export const DISABILITY_LABELS: Record<number, string> = {
  1: 'Visual Impairment',
  2: 'Hearing Impairment',
  3: 'Speech & Language',
  4: 'Locomotor Disability',
  5: 'Mental Retardation',
  6: 'Learning Disability',
  7: 'Autism',
  8: 'Multiple Disabilities',
  9: 'Others',
};

export const FACILITY_LABELS: Record<FacilityReceived, string> = {
  FREE_TEXTBOOKS: 'Free Textbooks',
  FREE_UNIFORM: 'Free Uniform',
  FREE_TRANSPORT: 'Free Transport',
  FREE_BICYCLE: 'Free Bicycle',
  SCHOLARSHIP: 'Scholarship',
  MID_DAY_MEAL: 'Mid-Day Meal',
  FREE_STATIONERY: 'Free Stationery',
  OTHERS: 'Others',
};

export const MOTHER_TONGUE_LABELS: Record<number, string> = {
  1: 'Assamese',
  2: 'Bengali',
  3: 'Gujarati',
  4: 'Hindi',
  5: 'Kannada',
  6: 'Kashmiri',
  7: 'Konkani',
  8: 'Malayalam',
  9: 'Manipuri',
  10: 'Marathi',
  11: 'Nepali',
  12: 'Odia',
  13: 'Punjabi',
  14: 'Sanskrit',
  15: 'Sindhi',
  16: 'Tamil',
  17: 'Telugu',
  18: 'Urdu',
  19: 'English',
  20: 'Bodo',
  22: 'Dogri',
  23: 'Maithili',
  24: 'Santali',
};

// ── UDISE Completeness ────────────────────────────────────────────────────────

export interface UDISECompleteness {
  score: number;
  gp: { score: number; missing: string[] };
  ep: { score: number; missing: string[] };
  sf: { score: number; missing: string[] };
  isComplete: boolean;
}

// ── UDISE Student Profile ─────────────────────────────────────────────────────

export interface UDISEStudentProfile {
  userId: number;
  name: string;
  email: string;
  className: string;
  sectionName: string;
  classSectionId: number;
  academicYearName: string;
  enrollmentId: number;
  rollNumber: string | null;
  studentRollNumber: string | null;

  // GP: General Profile
  dateOfBirth: string | null;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
  phone: string | null;
  alternatePhone: string | null;
  addressLineOne: string | null;
  addressLineTwo: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;

  // National Identity
  pen: string | null;
  apaarId: string | null;
  stateStudentId: string | null;
  aadhaarMasked: string | null;
  aadhaarName: string | null;
  isAadhaarVerified: boolean;

  // Demographics
  socialCategory: number | null;
  religion: number | null;
  isMinority: boolean;
  motherTongueCode: number | null;
  isBpl: boolean;
  localityType: string | null;

  // EP: Enrollment Profile
  admissionNumber: string | null;
  admissionDate: string | null;
  enrollmentType: string | null;
  previousSchool: string | null;
  previousSchoolUdiseCode: string | null;
  previousClassResult: string | null;

  // SF: Student Facilities
  isCwsn: boolean;
  disabilityType: number | null;
  hasDisabilityCertificate: boolean;
  udidNumber: string | null;
  facilitiesReceived: string[];
  medicalInfo: string | null;

  udiseVerified: boolean;
  completeness: UDISECompleteness;
}

// ── Completeness Report ───────────────────────────────────────────────────────

export interface UDISECompletenessReport {
  success: boolean;
  summary: {
    totalStudents: number;
    fullyComplete: number;
    partiallyComplete: number;
    notStarted: number;
    averageScore: number;
    academicYear: string;
  };
  bySection: {
    gpComplete: number;
    epComplete: number;
    sfComplete: number;
  };
  students: Array<{
    userId: number;
    name: string;
    className: string;
    sectionName: string;
    completeness: UDISECompleteness;
  }>;
}

// ── Update Payload ────────────────────────────────────────────────────────────

export interface UpdateUDISEProfilePayload {
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianRelation?: string;
  pen?: string | null;
  apaarId?: string | null;
  stateStudentId?: string | null;
  aadhaarMasked?: string | null;
  aadhaarName?: string | null;
  previousSchoolUdiseCode?: string | null;
  enrollmentType?: EnrollmentType;
  previousClassResult?: PreviousClassResult | null;
  admissionNumber?: string | null;
  admissionDate?: string;
  previousSchool?: string;
  rollNumber?: string;
  socialCategory?: number | null;
  religion?: number | null;
  isMinority?: boolean;
  motherTongueCode?: number | null;
  isBpl?: boolean;
  localityType?: LocalityType | null;
  isCwsn?: boolean;
  disabilityType?: number | null;
  hasDisabilityCertificate?: boolean;
  udidNumber?: string | null;
  facilitiesReceived?: FacilityReceived[];
  isAadhaarVerified?: boolean;
  udiseVerified?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StudentUdiseService {
  private base = 'school/students/udise';

  constructor(private api: ApiService) {}

  /**
   * GET /school/students/udise/profile/:studentId
   * Returns all UDISE-relevant fields for a single student.
   */
  getProfile(studentId: number): Observable<{ success: boolean; profile: UDISEStudentProfile }> {
    return this.api.get<{ success: boolean; profile: UDISEStudentProfile }>(
      `${this.base}/profile/${studentId}`
    );
  }

  /**
   * PUT /school/students/udise/profile/:studentId
   * Update UDISE-specific fields for a single student.
   */
  updateProfile(
    studentId: number,
    data: UpdateUDISEProfilePayload
  ): Observable<{ success: boolean; message: string }> {
    return this.api.put<{ success: boolean; message: string }>(
      `${this.base}/profile/${studentId}`,
      data
    );
  }

  /**
   * GET /school/students/udise/completeness
   * School-wide UDISE completeness dashboard.
   */
  getCompleteness(
    params: {
      academicYearId?: number;
      classSectionId?: number;
    } = {}
  ): Observable<UDISECompletenessReport> {
    let httpParams = new HttpParams();
    if (params.academicYearId != null)
      httpParams = httpParams.set('academicYearId', String(params.academicYearId));
    if (params.classSectionId != null)
      httpParams = httpParams.set('classSectionId', String(params.classSectionId));
    return this.api.get<UDISECompletenessReport>(`${this.base}/completeness`, httpParams);
  }

  /**
   * GET /school/students/udise/export
   * Download UDISE+ 2025-26 SDMS-compatible .xlsx for whole school.
   */
  exportExcel(
    params: {
      academicYearId?: number;
      classSectionId?: number;
    } = {}
  ): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params.academicYearId != null)
      httpParams = httpParams.set('academicYearId', String(params.academicYearId));
    if (params.classSectionId != null)
      httpParams = httpParams.set('classSectionId', String(params.classSectionId));
    // Use HttpClient directly for blob response
    return this.api.getBlob(`${this.base}/export`, httpParams);
  }

  /**
   * GET /school/students/udise/export/class-section/:classSectionId
   * Convenience export for a specific class-section.
   */
  exportClassSectionExcel(classSectionId: number, academicYearId?: number): Observable<Blob> {
    let httpParams = new HttpParams();
    if (academicYearId != null)
      httpParams = httpParams.set('academicYearId', String(academicYearId));
    return this.api.getBlob(`${this.base}/export/class-section/${classSectionId}`, httpParams);
  }
}
