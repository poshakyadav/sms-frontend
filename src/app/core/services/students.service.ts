// students.service.ts

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── UDISE+ Enum Types (mirroring backend) ─────────────────────────────────────
export type EnrollmentType = 'REGULAR' | 'PRIVATE' | 'OPEN_SCHOOL';
export type PreviousClassResult = 'PROMOTED' | 'NOT_PROMOTED' | 'NEW_ADMISSION' | 'TRANSFERRED';
export type SocialCategory = 1 | 2 | 3 | 4 | 5;
export type Religion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type LocalityType = 'URBAN' | 'RURAL';
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

export const SOCIAL_CATEGORY_LABELS: Record<SocialCategory, string> = {
  1: 'General',
  2: 'SC',
  3: 'ST',
  4: 'OBC',
  5: 'OBC-NCL',
};

export const RELIGION_LABELS: Record<Religion, string> = {
  1: 'Hindu',
  2: 'Muslim',
  3: 'Christian',
  4: 'Sikh',
  5: 'Buddhist',
  6: 'Jain',
  7: 'Others',
  8: 'No Religion',
};

export const DISABILITY_TYPE_LABELS: Record<DisabilityType, string> = {
  1: 'Visual Impairment',
  2: 'Hearing Impairment',
  3: 'Speech & Language',
  4: 'Locomotor',
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

export const PREVIOUS_CLASS_RESULT_LABELS: Record<PreviousClassResult, string> = {
  PROMOTED: 'Promoted',
  NOT_PROMOTED: 'Not Promoted',
  NEW_ADMISSION: 'New Admission',
  TRANSFERRED: 'Transferred',
};

export const ENROLLMENT_TYPE_LABELS: Record<EnrollmentType, string> = {
  REGULAR: 'Regular',
  PRIVATE: 'Private',
  OPEN_SCHOOL: 'Open School',
};

// ── Core student data in a class-section ─────────────────────────────────────
export interface StudentInClassSection {
  // Identity (school_users)
  id: number;
  name: string;
  email: string;
  phone?: string;
  alternatePhone?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  isActive: boolean;

  // Address
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  // Parental / Guardian
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianRelation?: string;

  // School-internal (students table)
  admissionNumber?: string;
  admissionDate?: string;
  rollNumber?: string;
  enrollmentType?: EnrollmentType;
  previousSchool?: string;
  previousSchoolUdiseCode?: string;
  previousClassResult?: PreviousClassResult;
  medicalInfo?: string;

  // UDISE / National identity
  pen?: string;
  apaarId?: string;
  stateStudentId?: string;
  aadhaarMasked?: string;
  aadhaarName?: string;
  isAadhaarVerified?: boolean;
  udiseVerified?: boolean;

  // UDISE+ demographic
  socialCategory?: SocialCategory;
  religion?: Religion;
  isMinority?: boolean;
  motherTongueCode?: number;

  // Socio-economic
  isBpl?: boolean;
  localityType?: LocalityType;

  // CWSN
  isCwsn?: boolean;
  disabilityType?: DisabilityType;
  hasDisabilityCertificate?: boolean;
  udidNumber?: string;

  // Facilities
  facilitiesReceived?: FacilityReceived[];

  // Enrollment details
  enrollmentId: number;
  classSectionId: number;
  className: string;
  sectionName: string;
  enrollmentDate?: string;
  academicYearId: number;
}

// ── Basic student (list endpoint) ─────────────────────────────────────────────
export interface StudentBasic {
  id: number;
  name: string;
  email: string;
  phone?: string;
  alternatePhone?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  isActive: boolean;
  // school_users — address
  addressLineOne?: string;
  addressLineTwo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  // school_users — parental
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianRelation?: string;
  // students
  admissionNumber?: string;
  admissionDate?: string;
  rollNumber?: string;
  enrollmentType?: EnrollmentType;
  previousSchool?: string;
  previousSchoolUdiseCode?: string;
  previousClassResult?: PreviousClassResult;
  medicalInfo?: string;
  pen?: string;
  apaarId?: string;
  stateStudentId?: string;
  aadhaarMasked?: string;
  aadhaarName?: string;
  isAadhaarVerified?: boolean;
  udiseVerified?: boolean;
  socialCategory?: SocialCategory;
  religion?: Religion;
  isMinority?: boolean;
  motherTongueCode?: number;
  isBpl?: boolean;
  localityType?: LocalityType;
  isCwsn?: boolean;
  disabilityType?: DisabilityType;
  hasDisabilityCertificate?: boolean;
  udidNumber?: string;
  facilitiesReceived?: FacilityReceived[];
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
  createdAt?: string;
  enrollments: StudentEnrollment[];
  parents: StudentParent[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StudentsService {
  constructor(private api: ApiService) {}

  /** All students — requires students.list permission */
  getStudents(): Observable<{ students: StudentBasic[] }> {
    return this.api.get<{ students: StudentBasic[] }>('school/students');
  }

  /** Single student with full UDISE profile, enrollments + parents */
  getStudentById(id: number): Observable<{ student: StudentDetail }> {
    return this.api.get<{ student: StudentDetail }>(`school/students/${id}`);
  }

  /** Students enrolled in a specific class-section (current year) — full UDISE fields */
  getStudentsByClassSection(
    classSectionId: number
  ): Observable<{ students: StudentInClassSection[] }> {
    return this.api.get<{ students: StudentInClassSection[] }>(
      `school/students/by-class-section?classSectionId=${classSectionId}`
    );
  }
}
