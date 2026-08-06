// bulk-upload.service.ts — v4
//
// Changes from v3:
//   • S.No. (serial number) helper column added as column A — auto-fills row
//     numbers so users can track progress without counting manually.
//     The column is formula-driven (=IF(B4="","",ROW()-3)) so it fills
//     automatically as data is entered and stays blank for empty rows.
//   • COLUMNS array now has sno as index 0; all guide-sheet and autoFilter
//     references updated accordingly.
//   • Template title row removed from the data sheet entirely — it was the
//     root cause of the parser mis-counting bug (merged title cell in row 1
//     caused sheet_to_json to read the title as the "header" row, making all
//     column lookups wrong and counting hint + sample rows as student data).
//     The sheet now starts directly with the header row at row 1, hint at
//     row 2, sample rows at 3-4, and blank data rows from row 5 onwards.
//     This gives the backend parser a clean, unambiguous layout to detect.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkUploadRowResult {
  rowNumber: number;
  name: string;
  email: string;
  username?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error?: string;
  userId?: number;
  udiseWarnings?: Array<{
    rowNumber: number;
    field: 'pen' | 'apaarId' | 'previousSchoolUdiseCode';
    value: string;
    message: string;
  }>;
}

export interface EmailConflict {
  rowNumber: number;
  name: string;
  email: string;
  conflictType: 'DUPLICATE_IN_FILE' | 'ALREADY_IN_SCHOOL';
}

export interface UsernameConflict {
  rowNumber: number;
  name: string;
  username: string;
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
    udiseWarnings?: number;
  };
  results: BulkUploadRowResult[];
  emailConflicts?: EmailConflict[];
  usernameConflicts?: UsernameConflict[];
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

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN DEFINITIONS  (single source of truth for template + guide)
//
// IMPORTANT: S.No. is index 0 (column A). It is display-only — the backend
// parser explicitly ignores it. All data columns start at index 1 (column B).
// ─────────────────────────────────────────────────────────────────────────────

interface ColDef {
  header: string;
  key: string;
  width: number;
  required: boolean;
  isHelper: boolean; // true = display-only, not uploaded
  group:
  | 'helper'
  | 'core'
  | 'contact'
  | 'personal'
  | 'parental'
  | 'address'
  | 'school'
  | 'udise_academic'
  | 'udise_demo'
  | 'udise_id';
  hint: string;
  example: string;
  example2: string;
}

const COLUMNS: ColDef[] = [
  // ── S.No. helper (col A — display only, NOT uploaded) ─────────────────────
  {
    header: 'S.No.',
    key: 'sno',
    width: 8,
    required: false,
    isHelper: true,
    group: 'helper',
    hint: 'Auto-fills as you enter data — do not edit this column',
    example: '', // formula-driven, set separately
    example2: '',
  },

  // ── Core (required) ────────────────────────────────────────────────────────
  {
    header: 'Name *',
    key: 'name',
    width: 28,
    required: true,
    isHelper: false,
    group: 'core',
    hint: 'Student full name (min 2 characters)',
    example: 'Rahul Sharma',
    example2: 'Priya Verma',
  },
  {
    header: 'Email',
    key: 'email',
    width: 32,
    required: false,
    isHelper: false,
    group: 'core',
    hint: 'Unique login email — must not exist in this school',
    example: 'rahul.sharma@example.com',
    example2: '',
  },
  {
    header: 'Password *',
    key: 'password',
    width: 18,
    required: true,
    isHelper: false,
    group: 'core',
    hint: 'Min 8 characters. Student uses this to first log in.',
    example: 'Welcome@123',
    example2: 'School@456',
  },

  {
    header: 'Username',
    key: 'username',
    width: 22,
    required: false,
    isHelper: false,
    group: 'core',
    hint: 'Optional — lowercase letters/numbers, must start with a letter. Leave blank to auto-generate (e.g. name+class+section → "amit2a")',
    example: 'amit2a',
    example2: '', // second sample deliberately blank to show auto-generate in action
  },

  // ── Contact ────────────────────────────────────────────────────────────────
  {
    header: 'Phone',
    key: 'phone',
    width: 16,
    required: false,
    isHelper: false,
    group: 'contact',
    hint: 'Primary contact number (10–15 digits)',
    example: '9876543210',
    example2: '9876543211',
  },
  {
    header: 'Alternate Phone',
    key: 'alternatePhone',
    width: 18,
    required: false,
    isHelper: false,
    group: 'contact',
    hint: 'Secondary phone number (optional)',
    example: '',
    example2: '',
  },

  // ── Personal ───────────────────────────────────────────────────────────────
  {
    header: 'Date of Birth',
    key: 'dob',
    width: 18,
    required: false,
    isHelper: false,
    group: 'personal',
    hint: 'Format: YYYY-MM-DD (e.g. 2010-06-15)',
    example: '2010-06-15',
    example2: '2010-08-20',
  },
  {
    header: 'Gender',
    key: 'gender',
    width: 14,
    required: false,
    isHelper: false,
    group: 'personal',
    hint: 'Male / Female / Transgender',
    example: 'Male',
    example2: 'Female',
  },
  {
    header: 'Blood Group',
    key: 'bloodGroup',
    width: 14,
    required: false,
    isHelper: false,
    group: 'personal',
    hint: 'A+ / A- / B+ / B- / AB+ / AB- / O+ / O-',
    example: 'B+',
    example2: 'O+',
  },

  // ── Parental / guardian ────────────────────────────────────────────────────
  {
    header: 'Father Name',
    key: 'fatherName',
    width: 24,
    required: false,
    isHelper: false,
    group: 'parental',
    hint: "Father's full name (UDISE+ required)",
    example: 'Suresh Sharma',
    example2: 'Vikram Verma',
  },
  {
    header: 'Mother Name',
    key: 'motherName',
    width: 24,
    required: false,
    isHelper: false,
    group: 'parental',
    hint: "Mother's full name (UDISE+ required)",
    example: 'Sunita Sharma',
    example2: 'Kavita Verma',
  },
  {
    header: 'Guardian Name',
    key: 'guardianName',
    width: 24,
    required: false,
    isHelper: false,
    group: 'parental',
    hint: 'Guardian name if neither parent is primary caregiver',
    example: '',
    example2: '',
  },
  {
    header: 'Guardian Relation',
    key: 'guardianRelation',
    width: 20,
    required: false,
    isHelper: false,
    group: 'parental',
    hint: 'e.g. Grandfather, Uncle, Legal Guardian',
    example: '',
    example2: '',
  },

  // ── Address ────────────────────────────────────────────────────────────────
  {
    header: 'Address Line 1',
    key: 'addr1',
    width: 30,
    required: false,
    isHelper: false,
    group: 'address',
    hint: 'Street / house number',
    example: '12 Gandhi Marg',
    example2: '45 Nehru Colony',
  },
  {
    header: 'Address Line 2',
    key: 'addr2',
    width: 30,
    required: false,
    isHelper: false,
    group: 'address',
    hint: 'Locality / area / mohalla',
    example: 'Kidwai Nagar',
    example2: 'Civil Lines',
  },
  {
    header: 'City',
    key: 'city',
    width: 18,
    required: false,
    isHelper: false,
    group: 'address',
    hint: 'City or town name',
    example: 'Lucknow',
    example2: 'Kanpur',
  },
  {
    header: 'State',
    key: 'state',
    width: 18,
    required: false,
    isHelper: false,
    group: 'address',
    hint: 'State name',
    example: 'Uttar Pradesh',
    example2: 'Uttar Pradesh',
  },
  {
    header: 'Postal Code',
    key: 'pincode',
    width: 14,
    required: false,
    isHelper: false,
    group: 'address',
    hint: '6-digit Indian PIN code',
    example: '226001',
    example2: '208001',
  },

  // ── School-internal ────────────────────────────────────────────────────────
  {
    header: 'Admission Number',
    key: 'admNo',
    width: 20,
    required: false,
    isHelper: false,
    group: 'school',
    hint: "School's own admission / registration number",
    example: 'ADM-2025-001',
    example2: 'ADM-2025-002',
  },
  {
    header: 'Admission Date',
    key: 'admDate',
    width: 18,
    required: false,
    isHelper: false,
    group: 'school',
    hint: 'Format: YYYY-MM-DD',
    example: '2025-04-01',
    example2: '2025-04-01',
  },
  {
    header: 'Previous School',
    key: 'prevSchool',
    width: 28,
    required: false,
    isHelper: false,
    group: 'school',
    hint: 'Name of school student transferred from',
    example: 'Delhi Public School',
    example2: '',
  },
  {
    header: 'Medical Info',
    key: 'medical',
    width: 28,
    required: false,
    isHelper: false,
    group: 'school',
    hint: 'Allergies, conditions, emergency notes',
    example: 'No allergies',
    example2: '',
  },

  // ── UDISE academic ─────────────────────────────────────────────────────────
  {
    header: 'Enrollment Type',
    key: 'enrollType',
    width: 18,
    required: false,
    isHelper: false,
    group: 'udise_academic',
    hint: 'REGULAR / PRIVATE / OPEN_SCHOOL (default: REGULAR)',
    example: 'REGULAR',
    example2: 'REGULAR',
  },
  {
    header: 'Previous Class Result',
    key: 'prevResult',
    width: 22,
    required: false,
    isHelper: false,
    group: 'udise_academic',
    hint: 'PROMOTED / NOT_PROMOTED / NEW_ADMISSION / TRANSFERRED',
    example: 'NEW_ADMISSION',
    example2: 'NEW_ADMISSION',
  },
  {
    header: 'Previous School UDISE Code',
    key: 'prevUdise',
    width: 28,
    required: false,
    isHelper: false,
    group: 'udise_academic',
    hint: '11-digit UDISE code of previous school',
    example: '',
    example2: '',
  },

  // ── UDISE demographic ──────────────────────────────────────────────────────
  {
    header: 'Social Category',
    key: 'socialCat',
    width: 18,
    required: false,
    isHelper: false,
    group: 'udise_demo',
    hint: '1=General, 2=SC, 3=ST, 4=OBC, 5=OBC-NCL, 6=Minority  (or type name)',
    example: '1',
    example2: '1',
  },
  {
    header: 'Religion',
    key: 'religion',
    width: 16,
    required: false,
    isHelper: false,
    group: 'udise_demo',
    hint: '1=Hindu 2=Muslim 3=Christian 4=Sikh 5=Buddhist 6=Jain 7=Others 8=None',
    example: '1',
    example2: '1',
  },

  // ── UDISE / national identity ──────────────────────────────────────────────
  {
    header: 'PEN',
    key: 'pen',
    width: 20,
    required: false,
    isHelper: false,
    group: 'udise_id',
    hint: '16-digit Permanent Education Number',
    example: '',
    example2: '',
  },
  {
    header: 'APAAR ID',
    key: 'apaar',
    width: 18,
    required: false,
    isHelper: false,
    group: 'udise_id',
    hint: '12-digit APAAR / ABC ID',
    example: '',
    example2: '',
  },
  {
    header: 'State Student ID',
    key: 'stateId',
    width: 22,
    required: false,
    isHelper: false,
    group: 'udise_id',
    hint: 'SAMAGRA ID or other state-specific student ID',
    example: '',
    example2: '',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE (ARGB format for ExcelJS)
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  REQ_FILL: 'FF3730A3',
  REQ_TEXT: 'FFFFFFFF',
  OPT_FILL: 'FF334155',
  OPT_TEXT: 'FFFFFFFF',
  // Helper column (S.No.) — distinct grey so users know not to edit it
  HELPER_FILL: 'FF475569', // slate-600
  HELPER_TEXT: 'FFFFFFFF',
  HELPER_DATA_FILL: 'FFF1F5F9', // slate-100
  HELPER_DATA_TEXT: 'FF94A3B8', // slate-400 — muted, clearly secondary
  GROUP_FILL: 'FFF1F5F9',
  GROUP_TEXT: 'FF475569',
  SAMPLE1_FILL: 'FFEFF6FF',
  SAMPLE2_FILL: 'FFF0FDF4',
  GUIDE_TITLE: 'FF1E3A5F',
  GUIDE_TEXT: 'FF334155',
  BORDER_CLR: 'FFB0BEC5',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BulkUploadService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // ── Capacity check ──────────────────────────────────────────────────────────
  getCapacityInfo(
    classSectionId: number
  ): Observable<{ success: boolean } & ClassSectionCapacityInfo> {
    return this.http
      .get<{ success: boolean } & ClassSectionCapacityInfo>(
        `${this.baseUrl}/school/students/bulk-upload/capacity/${classSectionId}`
      )
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ── File upload ─────────────────────────────────────────────────────────────
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

  // ── Styled Excel template download (ExcelJS) ────────────────────────────────
  // async downloadTemplate(): Promise<void> {
  //   const ExcelJS = await import('exceljs');
  //   const { saveAs } = await import('file-saver');

  //   const workbook = new ExcelJS.Workbook();
  //   workbook.creator = 'School Management System';
  //   workbook.created = new Date();

  //   await this._buildStudentSheet(workbook, ExcelJS);
  //   await this._buildGuideSheet(workbook, ExcelJS);

  //   const buffer = await workbook.xlsx.writeBuffer();
  //   const blob = new Blob([buffer], {
  //     type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //   });
  //   saveAs(blob, 'bulk_student_upload_template_v4.xlsx');
  // }

  // ── Styled Excel template download (ExcelJS) ────────────────────────────────
  async downloadTemplate(): Promise<void> {
    const ExcelJSModule: any = await import('exceljs');
    // Production bundlers (esbuild/Cloudflare) sometimes nest the real CJS
    // exports under `.default` instead of hoisting them to the namespace root.
    // Resolve whichever shape actually has `Workbook` on it.
    const ExcelJS: any = ExcelJSModule.Workbook
      ? ExcelJSModule
      : ExcelJSModule.default ?? ExcelJSModule;

    const fileSaverModule: any = await import('file-saver');
    const saveAs: (blob: Blob, filename: string) => void =
      fileSaverModule.saveAs ?? fileSaverModule.default?.saveAs ?? fileSaverModule.default;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management System';
    workbook.created = new Date();

    await this._buildStudentSheet(workbook, ExcelJS);
    await this._buildGuideSheet(workbook, ExcelJS);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'bulk_student_upload_template_v4.xlsx');
  }

  // ── Build "Students" sheet ──────────────────────────────────────────────────
  //
  // ROW LAYOUT (v4):
  //   Row 1  → Header row  (Name *, Email *, …)    ← parser detects via isHeaderRow()
  //   Row 2  → Hint row    (italic field notes)     ← parser skips (hintRowIndex)
  //   Row 3  → Sample row 1 (Rahul Sharma)          ← parser skips (SAMPLE_ROW_COUNT = 2)
  //   Row 4  → Sample row 2 (Priya Verma)           ← parser skips (SAMPLE_ROW_COUNT = 2)
  //   Row 5+ → Blank data rows for user input       ← parser reads from dataStartIndex
  //
  // The S.No. column (col A) uses the formula =IF(B5="","",ROW()-4) so it
  // auto-fills as the user types names in column B and stays blank for empty
  // rows. The backend parser ignores column A entirely.
  //
  // The decorative note about "Fill from Row 5 onwards" is placed in a
  // frozen note area ABOVE the printable area so it doesn't appear in the
  // scrollable data region and can never confuse the parser.
  private async _buildStudentSheet(workbook: any, ExcelJS: any): Promise<void> {
    const totalCols = COLUMNS.length;

    const ws = workbook.addWorksheet('Students', {
      // Freeze header row (row 1) + hint row (row 2) so they stay visible
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
      pageSetup: { fitToPage: true, fitToWidth: 1 },
    });

    // ── Row 1: Header row ──────────────────────────────────────────────────────
    // This is now the FIRST row — no merged title above it.
    // The backend parser scans for the row containing 'name', 'email', 'password'
    // as separate cell values; this row will always be found correctly.
    const headerRow = ws.getRow(1);
    headerRow.height = 30;

    COLUMNS.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;

      if (col.isHelper) {
        // S.No. column — distinct "helper" styling
        cell.font = { bold: true, size: 10, color: { argb: COLORS.HELPER_TEXT } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.HELPER_FILL },
        };
      } else {
        cell.font = {
          bold: true,
          size: 10,
          color: { argb: col.required ? COLORS.REQ_TEXT : COLORS.OPT_TEXT },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: col.required ? COLORS.REQ_FILL : COLORS.OPT_FILL },
        };
      }

      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
      };
    });

    // ── Row 2: Hint row ────────────────────────────────────────────────────────
    const hintRow = ws.getRow(2);
    hintRow.height = 40;

    COLUMNS.forEach((col, idx) => {
      const cell = hintRow.getCell(idx + 1);

      if (col.isHelper) {
        cell.value = 'Auto-fills when you enter data in column B → Do NOT edit this column';
        cell.font = { italic: true, size: 8, color: { argb: 'FF94A3B8' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.HELPER_DATA_FILL },
        };
      } else {
        cell.value = col.hint;
        cell.font = { italic: true, size: 8, color: { argb: 'FF64748B' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.GROUP_FILL },
        };
      }

      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        bottom: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
      };
    });

    // ── Rows 3–4: Sample rows ──────────────────────────────────────────────────
    // S.No. in sample rows shows static values (1, 2) so the user can see what
    // the auto-fill looks like. Real data rows use a formula.
    const samples = [
      { fill: COLORS.SAMPLE1_FILL, sno: 1, data: COLUMNS.map((c) => c.example) },
      { fill: COLORS.SAMPLE2_FILL, sno: 2, data: COLUMNS.map((c) => c.example2) },
    ];

    samples.forEach((sample, si) => {
      const excelRow = 3 + si; // rows 3 and 4
      const row = ws.getRow(excelRow);
      row.height = 20;

      COLUMNS.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);

        if (col.isHelper) {
          // Static number for the sample rows
          cell.value = sample.sno;
          cell.font = { size: 10, bold: true, color: { argb: COLORS.HELPER_DATA_TEXT } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.HELPER_DATA_FILL },
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.value = sample.data[idx];
          cell.font = { size: 10, color: { argb: COLORS.GUIDE_TEXT } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: sample.fill },
          };
          cell.alignment = { vertical: 'middle', wrapText: false };

          if (col.key === 'dob' || col.key === 'admDate') {
            cell.numFmt = '@';
          }
        }

        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          bottom: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        };
      });
    });

    // ── Rows 5–104: Blank data rows (100 rows ready for input) ────────────────
    //
    // S.No. formula: =IF(B5="","",ROW()-4)
    //   • ROW()-4  → row 5 gives 1, row 6 gives 2, etc.
    //   • IF(B5="","","") → stays blank if the Name column is empty,
    //     so un-filled rows don't show numbers and confuse the user.
    //
    // IMPORTANT: The formula checks column B (Name), not column A itself,
    // so the S.No. auto-fills as soon as the user types in the Name column.
    for (let r = 5; r <= 104; r++) {
      const row = ws.getRow(r);
      row.height = 18;

      COLUMNS.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);

        if (col.isHelper) {
          // col B in Excel = COLUMNS index 1 = the Name column
          // ROW()-4 because data starts at row 5 → 5-4=1
          cell.value = { formula: `IF(B${r}="","",ROW()-4)` };
          cell.font = { size: 10, color: { argb: COLORS.HELPER_DATA_TEXT } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.HELPER_DATA_FILL },
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            right: { style: 'medium', color: { argb: COLORS.BORDER_CLR } },
          };
        } else {
          cell.font = { size: 10 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          };
        }
      });
    }

    // ── Column widths ──────────────────────────────────────────────────────────
    COLUMNS.forEach((col, idx) => {
      ws.getColumn(idx + 1).width = col.width;

      // FIX: applies Text format to the ENTIRE column (including rows 5–104,
      // where users actually type data) — not just the sample rows. Without
      // this, DOB/Admission Date typed by a real user still gets silently
      // converted to an Excel serial number by "General" format, same bug
      // as before, just no longer visible in the sample rows.
      if (col.key === 'dob' || col.key === 'admDate') {
        ws.getColumn(idx + 1).numFmt = '@';
      }
    });

    // ── Auto-filter on header row (row 1), starting from col 2 to skip S.No. ──
    // S.No. is intentionally excluded from the filter — filtering a formula
    // column causes confusing results and the column is display-only anyway.
    ws.autoFilter = {
      from: { row: 1, column: 2 },
      to: { row: 1, column: totalCols },
    };

    // ── Legend / note rows at the bottom ──────────────────────────────────────
    const legendRow = 107;

    ws.mergeCells(legendRow, 1, legendRow, 5);
    const legendA = ws.getCell(legendRow, 1);
    legendA.value = '🔴  Required fields (dark indigo header)';
    legendA.font = { bold: true, size: 9, color: { argb: 'FFDC2626' } };

    ws.mergeCells(legendRow, 6, legendRow, 11);
    const legendB = ws.getCell(legendRow, 6);
    legendB.value = '🔵  Optional fields (slate header)';
    legendB.font = { bold: true, size: 9, color: { argb: 'FF1E40AF' } };

    ws.mergeCells(legendRow, 12, legendRow, totalCols);
    const legendC = ws.getCell(legendRow, 12);
    legendC.value = '⬜  S.No. = helper column, auto-fills, do NOT upload as data';
    legendC.font = { bold: true, size: 9, color: { argb: 'FF475569' } };

    const noteRow = legendRow + 1;
    ws.mergeCells(noteRow, 1, noteRow, totalCols);
    const noteCell = ws.getCell(noteRow, 1);
    noteCell.value =
      '✅  Keep the sample rows as a reference — they are auto-skipped on upload  |' +
      '  Fill YOUR data from Row 5 onwards  |' +
      '  Roll numbers are NOT assigned here — use the Roll Numbers feature in Academics after upload';
    noteCell.font = { italic: true, size: 9, color: { argb: 'FF92400E' } };
    noteCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    noteCell.alignment = { wrapText: true };
    ws.getRow(noteRow).height = 30;
  }

  // ── Build "Guide" sheet ────────────────────────────────────────────────────
  private async _buildGuideSheet(workbook: any, ExcelJS: any): Promise<void> {
    const ws = workbook.addWorksheet('📖 Guide', {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 62;
    ws.getColumn(5).width = 24;

    let r = 1;

    const addTitle = (text: string) => {
      ws.mergeCells(r, 1, r, 5);
      const cell = ws.getCell(r, 1);
      cell.value = text;
      cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.GUIDE_TITLE },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(r).height = 32;
      r++;
    };

    const addSectionHeader = (text: string) => {
      ws.mergeCells(r, 1, r, 5);
      const cell = ws.getCell(r, 1);
      cell.value = text;
      cell.font = { bold: true, size: 11, color: { argb: COLORS.GUIDE_TITLE } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.GROUP_FILL },
      };
      cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      ws.getRow(r).height = 22;
      r++;
    };

    const addColumnHeader = () => {
      const hRow = ws.getRow(r);
      ['Column Name', 'Required?', 'Type', 'Description / Notes', 'Example'].forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.OPT_FILL },
        };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'medium', color: { argb: '9F94A3B8' } } };
      });
      ws.getRow(r).height = 22;
      r++;
    };

    const addColRow = (col: ColDef, shade: boolean) => {
      const row = ws.getRow(r);
      const bg = shade ? 'FFF8FAFC' : 'FFFFFFFF';
      const typeLabel = col.isHelper ? 'Helper' : col.group;
      [
        col.header.replace(' *', ''),
        col.isHelper ? '—' : col.required ? '✅ YES' : 'No',
        typeLabel,
        col.hint,
        col.example || '—',
      ].forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = {
          size: 9,
          italic: col.isHelper,
          color: {
            argb: col.isHelper
              ? 'FF64748B'
              : i === 1 && col.required
                ? 'FF991B1B'
                : COLORS.GUIDE_TEXT,
          },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: col.isHelper ? COLORS.HELPER_DATA_FILL : bg },
        };
        cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      });
      ws.getRow(r).height = col.isHelper ? 22 : 32;
      r++;
    };

    const addBlank = () => {
      r++;
    };

    const addNote = (text: string, bgArgb = 'FFFEF9C3') => {
      ws.mergeCells(r, 1, r, 5);
      const cell = ws.getCell(r, 1);
      cell.value = text;
      cell.font = { size: 9, italic: true, color: { argb: '92400E' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.alignment = { wrapText: true, indent: 1 };
      ws.getRow(r).height = 28;
      r++;
    };

    // ── Content ────────────────────────────────────────────────────────────────
    addTitle('📋  Bulk Student Upload — Field Guide  (v4)');
    addBlank();

    // S.No. helper note at the top of the guide
    addSectionHeader('⬜  S.No. Column (Column A) — Helper Only');
    addColumnHeader();
    addColRow(COLUMNS[0], false); // sno
    addNote(
      '⚠  The S.No. column is for your reference only. It auto-fills as you enter student names.' +
      ' Do NOT manually type numbers here. This column is completely ignored during upload.',
      'FFF0F9FF'
    );
    addBlank();

    const groups: Array<{ label: string; group: ColDef['group'] }> = [
      { label: '✅  Required Fields', group: 'core' },
      { label: '📞  Contact', group: 'contact' },
      { label: '👤  Personal', group: 'personal' },
      { label: '👨‍👩‍👧  Parental / Guardian  (UDISE+)', group: 'parental' },
      { label: '🏠  Address', group: 'address' },
      { label: '🏫  School-Internal', group: 'school' },
      { label: '📊  UDISE+ Academic', group: 'udise_academic' },
      { label: '🌐  UDISE+ Demographic', group: 'udise_demo' },
      { label: '🆔  UDISE+ / National Identity IDs', group: 'udise_id' },
    ];

    groups.forEach((g) => {
      addSectionHeader(g.label);
      addColumnHeader();
      COLUMNS.filter((c) => c.group === g.group).forEach((col, i) => addColRow(col, i % 2 === 1));
      addBlank();
    });

    addSectionHeader('⚠  Important Rules');
    const rules = [
      '1. Do NOT delete the sample rows (rows 3 & 4) — the parser skips them automatically. Use them as a reference while filling.',
      '2. Fill your data from Row 5 onwards. Do NOT change column names or their order.',
      '3. The S.No. column (Column A) auto-fills — never type in it manually; it is ignored on upload.',
      '4. Email is now OPTIONAL — leave it blank if a student has no email address.', // NEW
      '5. Every Email must be unique — both within the file AND across the entire school (only checked when provided).', // CHANGED
      '6. Username is OPTIONAL — leave blank to auto-generate one from the student\'s name + class + section. If you do fill it in, it must be unique, lowercase, and start with a letter.', // NEW
      '7. Passwords must be at least 8 characters. Students should change them on first login.',
      '8. If ANY email or username conflict is found, ZERO students are added. Fix all conflicts and re-upload.', // CHANGED
      '9. Roll numbers are NOT assigned here. Use the Roll Numbers feature in Academics → Class Sections after upload.',
      '10. To link parents/guardians, use the Parents module after upload.',
      '11. UDISE+ fields (PEN, APAAR, etc.) are optional but important for government reporting.',
      '12. Date format must be YYYY-MM-DD (e.g., 2010-06-15). Other formats may fail.',
      '13. The Guide sheet (this sheet) is completely ignored during upload.',
    ];
    rules.forEach((rule) => {
      ws.mergeCells(r, 1, r, 5);
      const cell = ws.getCell(r, 1);
      cell.value = rule;
      cell.font = { size: 9, color: { argb: COLORS.GUIDE_TEXT } };
      cell.alignment = { wrapText: true, indent: 2 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      ws.getRow(r).height = 22;
      r++;
    });
    addBlank();

    addNote(
      '📌  Need help? Contact your school administrator or refer to the SMS Help Center.',
      'FFE0F2FE'
    );
  }
}
