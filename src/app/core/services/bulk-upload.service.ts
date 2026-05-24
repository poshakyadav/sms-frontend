// bulk-upload.service.ts — v3 (production-grade, ExcelJS styled template)
//
// Key changes from v2:
//   • downloadTemplate() now uses ExcelJS for rich styled output:
//       - Colour-coded header row (required = red-tinted, optional = blue-tinted)
//       - Freeze first row + auto-filter
//       - Two sample rows with realistic Indian school data
//       - Separate Guide sheet with full field documentation
//       - Column widths tuned for content
//   • rollNumber field REMOVED from template (assigned separately via Roll Numbers feature)
//   • EmailConflict / BulkUploadResult types updated to match backend v4 (udiseWarnings)
//   • uploadStudents() academicYearId param preserved for future use
//   • All ExcelJS imports are dynamic (lazy) to keep initial bundle lean

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
// ─────────────────────────────────────────────────────────────────────────────

interface ColDef {
  header: string;
  key: string;
  width: number;
  required: boolean;
  group:
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
  // ── Core (required) ────────────────────────────────────────────────────────
  {
    header: 'Name *',
    key: 'name',
    width: 28,
    required: true,
    group: 'core',
    hint: 'Student full name (min 2 characters)',
    example: 'Rahul Sharma',
    example2: 'Priya Verma',
  },
  {
    header: 'Email *',
    key: 'email',
    width: 32,
    required: true,
    group: 'core',
    hint: 'Unique login email — must not exist in this school',
    example: 'rahul.sharma@example.com',
    example2: 'priya.verma@example.com',
  },
  {
    header: 'Password *',
    key: 'password',
    width: 18,
    required: true,
    group: 'core',
    hint: 'Min 8 characters. Student uses this to first log in.',
    example: 'Welcome@123',
    example2: 'School@456',
  },

  // ── Contact ────────────────────────────────────────────────────────────────
  {
    header: 'Phone',
    key: 'phone',
    width: 16,
    required: false,
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
    group: 'udise_demo',
    hint: '1=General, 2=SC, 3=ST, 4=OBC, 5=OBC-NCL  (or type name)',
    example: '1',
    example2: '1',
  },
  {
    header: 'Religion',
    key: 'religion',
    width: 16,
    required: false,
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
  // Required header — deep indigo fill, white text
  REQ_FILL: 'FF3730A3', // indigo-700
  REQ_TEXT: 'FFFFFFFF',
  // Optional header — slate-blue fill, white text
  OPT_FILL: 'FF334155', // slate-700
  OPT_TEXT: 'FFFFFFFF',
  // Group sub-header row — light background
  GROUP_FILL: 'FFF1F5F9', // slate-100
  GROUP_TEXT: 'FF475569', // slate-600
  // Sample rows
  SAMPLE1_FILL: 'FFEFF6FF', // blue-50
  SAMPLE2_FILL: 'FFF0FDF4', // green-50
  // Guide title
  GUIDE_TITLE: 'FF1E3A5F',
  GUIDE_TEXT: 'FF334155',
  // Border
  BORDER_CLR: 'FFB0BEC5',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BulkUploadService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

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
  async downloadTemplate(): Promise<void> {
    // Dynamic import keeps the initial bundle lean
    const ExcelJS = await import('exceljs');
    const { saveAs } = await import('file-saver');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management System';
    workbook.created = new Date();

    await this._buildStudentSheet(workbook, ExcelJS);
    await this._buildGuideSheet(workbook, ExcelJS);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'bulk_student_upload_template_v3.xlsx');
  }

  // ── Build "Students" sheet ──────────────────────────────────────────────────
  private async _buildStudentSheet(workbook: any, ExcelJS: any): Promise<void> {
    const ws = workbook.addWorksheet('Students', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }], // freeze first 2 rows
      pageSetup: { fitToPage: true, fitToWidth: 1 },
    });

    // ── Title row (row 1) ──────────────────────────────────────────────────────
    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const titleCell = ws.getCell('A1');
    titleCell.value =
      '📋  Student Bulk Upload Template  —  Fill from Row 4 onwards  |  Do NOT change column headers or order';
    titleCell.font = { bold: true, size: 11, color: { argb: COLORS.GUIDE_TITLE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // blue-100
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    ws.getRow(1).height = 24;

    // ── Header row (row 2) ─────────────────────────────────────────────────────
    const headerRow = ws.getRow(2);
    headerRow.height = 28;

    COLUMNS.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
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
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
      };
    });

    // ── Hint row (row 3) ───────────────────────────────────────────────────────
    const hintRow = ws.getRow(3);
    hintRow.height = 40;

    COLUMNS.forEach((col, idx) => {
      const cell = hintRow.getCell(idx + 1);
      cell.value = col.hint;
      cell.font = { italic: true, size: 8, color: { argb: 'FF64748B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GROUP_FILL } };
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        bottom: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
      };
    });

    // ── Sample rows (rows 4–5) ─────────────────────────────────────────────────
    const samples = [
      { fill: COLORS.SAMPLE1_FILL, data: COLUMNS.map((c) => c.example) },
      { fill: COLORS.SAMPLE2_FILL, data: COLUMNS.map((c) => c.example2) },
    ];

    samples.forEach((sample, si) => {
      const row = ws.getRow(4 + si);
      row.height = 20;
      sample.data.forEach((val, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = val;
        cell.font = { size: 10, color: { argb: COLORS.GUIDE_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sample.fill } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          bottom: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        };
      });
    });

    // ── Blank data rows (6–55 — 50 rows ready for input) ──────────────────────
    for (let r = 6; r <= 55; r++) {
      const row = ws.getRow(r);
      row.height = 18;
      COLUMNS.forEach((_col, idx) => {
        const cell = row.getCell(idx + 1);
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: COLORS.BORDER_CLR } },
        };
      });
    }

    // ── Column widths ──────────────────────────────────────────────────────────
    COLUMNS.forEach((col, idx) => {
      ws.getColumn(idx + 1).width = col.width;
    });

    // ── Auto-filter on header row ──────────────────────────────────────────────
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: COLUMNS.length },
    };

    // ── Legend note at bottom ──────────────────────────────────────────────────
    const legendRow = 58;
    ws.mergeCells(legendRow, 1, legendRow, 6);
    const legendA = ws.getCell(legendRow, 1);
    legendA.value = '🔴  Required fields (dark header)';
    legendA.font = { bold: true, size: 9, color: { argb: 'FFDC2626' } };

    ws.mergeCells(legendRow, 7, legendRow, 12);
    const legendB = ws.getCell(legendRow, 7);
    legendB.value = '🔵  Optional fields (slate header)';
    legendB.font = { bold: true, size: 9, color: { argb: 'FF1E40AF' } };

    ws.mergeCells(legendRow + 1, 1, legendRow + 1, COLUMNS.length);
    const noteCell = ws.getCell(legendRow + 1, 1);
    noteCell.value =
      '⚠  Delete sample rows 4 & 5 before uploading  |  Roll numbers are NOT assigned here — use the Roll Numbers feature in Academics after upload';
    noteCell.font = { italic: true, size: 9, color: { argb: 'FF92400E' } };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    noteCell.alignment = { wrapText: true };
    ws.getRow(legendRow + 1).height = 30;
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
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GUIDE_TITLE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(r).height = 32;
      r++;
    };

    const addSectionHeader = (text: string) => {
      ws.mergeCells(r, 1, r, 5);
      const cell = ws.getCell(r, 1);
      cell.value = text;
      cell.font = { bold: true, size: 11, color: { argb: COLORS.GUIDE_TITLE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GROUP_FILL } };
      cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      ws.getRow(r).height = 22;
      r++;
    };

    const addColumnHeader = () => {
      const hRow = ws.getRow(r);
      ['Column Name', 'Required?', 'Format', 'Description / Notes', 'Example'].forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.OPT_FILL } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'medium', color: { argb: '9F94A3B8' } } };
      });
      ws.getRow(r).height = 22;
      r++;
    };

    const addColRow = (col: ColDef, shade: boolean) => {
      const row = ws.getRow(r);
      const bg = shade ? 'FFF8FAFC' : 'FFFFFFFF';
      [
        col.header.replace(' *', ''),
        col.required ? '✅ YES' : 'No',
        col.group,
        col.hint,
        col.example || '—',
      ].forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = {
          size: 9,
          color: { argb: i === 1 && col.required ? 'FF991B1B' : COLORS.GUIDE_TEXT },
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      });
      ws.getRow(r).height = 32;
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
    addTitle('📋  Bulk Student Upload — Field Guide  (v3)');
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
      '1. DELETE the two sample rows (rows 4 & 5) in the Students sheet before uploading.',
      '2. Do NOT change column names, column order, or the header/hint rows (rows 1–3).',
      '3. Every Email must be unique — both within the file AND across the entire school.',
      '4. Passwords must be at least 8 characters. Students should change them on first login.',
      '5. If ANY email conflict is found, ZERO students are added. Fix all conflicts and re-upload.',
      '6. Roll numbers are NOT assigned here. Use the Roll Numbers feature in Academics → Class Sections after upload.',
      '7. To link parents/guardians, use the Parents module after upload.',
      '8. UDISE+ fields (PEN, APAAR, etc.) are optional but important for government reporting. They can be filled later from the student profile.',
      '9. The Guide sheet (this sheet) is completely ignored during upload.',
      '10. Date format must be YYYY-MM-DD (e.g., 2010-06-15). Other formats may fail.',
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
