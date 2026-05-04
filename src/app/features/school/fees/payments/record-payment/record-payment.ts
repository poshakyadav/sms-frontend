// record-payment.ts  (UPDATED — uses FeePaymentDialog)
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AcademicsService, ClassSection } from '../../../../../core/services/academics.service';
import { EnrolledStudent, FeesService } from '../../../../../core/services/fees.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { FeePaymentDialog } from '../fee-payment-dialog/fee-payment-dialog';

@Component({
  selector: 'app-record-payment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    FeePaymentDialog,
  ],
  templateUrl: './record-payment.html',
  styleUrl: './record-payment.scss',
})
export class RecordPayment implements OnInit {
  private router = inject(Router);
  private feesService = inject(FeesService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);

  // ── Data ─────────────────────────────────────────────────────────────────
  classSections = signal<ClassSection[]>([]);
  students = signal<EnrolledStudent[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  pageLoading = signal(true);
  studentsLoading = signal(false);
  error = signal<string | null>(null);

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedClassSectionId = signal<number | null>(null);

  // ── Dialog ────────────────────────────────────────────────────────────────
  dialogStudent = signal<EnrolledStudent | null>(null);

  displayedColumns = ['rollNumber', 'name', 'totalAssigned', 'totalPaid', 'balance', 'actions'];

  totalBalance = computed(() => this.students().reduce((s, r) => s + (r.balance ?? 0), 0));
  totalCollected = computed(() => this.students().reduce((s, r) => s + (r.totalPaid ?? 0), 0));
  totalAssigned = computed(() => this.students().reduce((s, r) => s + (r.totalAssigned ?? 0), 0));

  ngOnInit() {
    this.loadClassSections();
  }

  loadClassSections() {
    this.pageLoading.set(true);
    this.academicsService.getClassSections().subscribe({
      next: (res) => {
        this.classSections.set(res.classSections ?? []);
        this.pageLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load class sections');
        this.pageLoading.set(false);
      },
    });
  }

  onClassSectionChange(classSectionId: number) {
    this.dialogStudent.set(null);
    this.selectedClassSectionId.set(classSectionId);
    this.loadStudents(classSectionId);
  }

  loadStudents(classSectionId: number) {
    this.studentsLoading.set(true);
    this.error.set(null);
    this.students.set([]);
    this.feesService.getStudentsByClassSection(classSectionId).subscribe({
      next: (res) => {
        this.students.set(res.students ?? []);
        this.studentsLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load students');
        this.studentsLoading.set(false);
      },
    });
  }

  // ── Dialog control ────────────────────────────────────────────────────────
  openPaymentDialog(student: EnrolledStudent) {
    this.dialogStudent.set(student);
  }

  onDialogClosed() {
    this.dialogStudent.set(null);
  }

  onPaymentRecorded() {
    // Dialog emits this before closing — reload table
    if (this.selectedClassSectionId()) {
      this.loadStudents(this.selectedClassSectionId()!);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  viewPaymentHistory(enrollmentId: number) {
    this.router.navigate(['/school/fees/payments-history', enrollmentId]);
  }

  viewLedger(studentId: number) {
    this.router.navigate(['/school/fees/ledger', studentId]);
  }
}
