// bulk-upload.service.ts — v2
// emailConflicts[] returned from 409 responses handled here

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BulkUploadRowResult {
  rowNumber: number;
  name: string;
  email: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error?: string;
  userId?: number;
}

export interface EmailConflict {
  rowNumber: number;
  name: string;
  email: string;
  conflictType: 'DUPLICATE_IN_FILE' | 'ALREADY_IN_SCHOOL';
}

export interface BulkUploadCapacityInfo {
  existingStudents: number;
  addedStudents: number;
  totalAfter: number;
  maxAllowed: number;
  remaining: number;
}

export interface BulkUploadResult {
  success: boolean;
  message: string;
  summary: {
    totalRows: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  results: BulkUploadRowResult[];
  emailConflicts?: EmailConflict[];
  capacityInfo?: BulkUploadCapacityInfo;
}

export interface ClassSectionCapacityInfo {
  classSectionId: number;
  className: string;
  sectionName: string;
  existingStudents: number;
  maxAllowed: number;
  remaining: number;
  canAddMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class BulkUploadService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCapacityInfo(
    classSectionId: number
  ): Observable<{ success: boolean } & ClassSectionCapacityInfo> {
    return this.http
      .get<{ success: boolean } & ClassSectionCapacityInfo>(
        `${this.baseUrl}/school/students/bulk-upload/capacity/${classSectionId}`
      )
      .pipe(catchError((err) => throwError(() => err)));
  }

  uploadStudents(
    classSectionId: number,
    file: File,
    academicYearId?: number
  ): Observable<BulkUploadResult> {
    const formData = new FormData();
    formData.append('classSectionId', String(classSectionId));
    formData.append('file', file);
    if (academicYearId) {
      formData.append('academicYearId', String(academicYearId));
    }

    return this.http
      .post<BulkUploadResult>(`${this.baseUrl}/school/students/bulk-upload`, formData)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /**
   * Generate and download the Excel template using SheetJS (client-side)
   */
  downloadTemplate(): void {
    import('xlsx').then((XLSX) => {
      const headers = [
        'Name *',
        'Email *',
        'Password *',
        'Phone',
        'Date of Birth (YYYY-MM-DD)',
        'Gender (Male/Female/Other)',
        'Admission Date (YYYY-MM-DD)',
        'Previous School',
        'Medical Info',
        'Blood Group (A+/A-/B+/B-/AB+/AB-/O+/O-)',
      ];

      const sample1 = [
        'Rahul Sharma',
        'rahul.sharma@example.com',
        'SecurePass123',
        '9876543210',
        '2010-06-15',
        'Male',
        '2024-04-01',
        'Delhi Public School',
        'No allergies',
        'B+',
      ];

      const sample2 = [
        'Priya Verma',
        'priya.verma@example.com',
        'SecurePass456',
        '9876543211',
        '2010-08-20',
        'Female',
        '2024-04-01',
        '',
        '',
        'O+',
      ];

      const wsData = [headers, sample1, sample2];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws['!cols'] = [
        { wch: 22 }, // Name
        { wch: 30 }, // Email
        { wch: 16 }, // Password
        { wch: 14 }, // Phone
        { wch: 22 }, // DOB
        { wch: 22 }, // Gender
        { wch: 22 }, // Admission Date
        { wch: 24 }, // Previous School
        { wch: 24 }, // Medical Info
        { wch: 36 }, // Blood Group
      ];

      // Guide sheet
      const guideData = [
        ['BULK STUDENT UPLOAD — GUIDE (v2)'],
        [''],
        ['REQUIRED FIELDS (marked with *)'],
        ['Name', 'Student full name (minimum 2 characters)'],
        ['Email', 'Unique email address for login — must not already exist in this school'],
        ['Password', 'Minimum 8 characters'],
        [''],
        ['OPTIONAL FIELDS'],
        ['Phone', '10–15 digit phone number'],
        ['Date of Birth', 'Format: YYYY-MM-DD (e.g. 2010-06-15)'],
        ['Gender', 'Male, Female, or Other'],
        ['Admission Date', 'Format: YYYY-MM-DD'],
        ['Previous School', 'Name of previous school (if transferring)'],
        ['Medical Info', 'Any medical conditions or allergies'],
        ['Blood Group', 'One of: A+, A-, B+, B-, AB+, AB-, O+, O-'],
        [''],
        ['IMPORTANT NOTES'],
        ['1. Maximum students per upload = the remaining capacity of the selected class-section'],
        ['2. Each email must be unique across the entire school'],
        ['3. Link parents/guardians separately via the Parents module after upload'],
        ['4. Roll numbers are NOT assigned here — use the Roll Numbers feature after upload'],
        ['5. Do not modify the header row or column order'],
        ['6. Delete the sample rows before uploading'],
        ['7. The Guide sheet is ignored during upload'],
        ['8. If any email conflicts exist, NO students will be added — fix all conflicts first'],
      ];

      const guideWs = XLSX.utils.aoa_to_sheet(guideData);
      guideWs['!cols'] = [{ wch: 28 }, { wch: 62 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.utils.book_append_sheet(wb, guideWs, 'Guide');

      XLSX.writeFile(wb, 'bulk_student_upload_template_v2.xlsx');
    });
  }
}
