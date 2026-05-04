// student-detail.ts

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';

import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  StudentsService,
  StudentDetail as StudentDetailModel,
} from '../../../../core/services/students.service';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTableModule,
  ],
  templateUrl: './student-detail.html',
  styleUrl: './student-detail.scss',
})
export class StudentDetail implements OnInit {
  private studentsService = inject(StudentsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  student = signal<StudentDetailModel | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  enrollmentColumns = ['class', 'rollNumber', 'enrollmentDate', 'status'];
  parentColumns = ['name', 'relationship', 'phone', 'email'];

  studentId = computed(() => {
    const id = parseInt(this.route.snapshot.paramMap.get('id') ?? '');
    return isNaN(id) ? null : id;
  });

  ngOnInit(): void {
    const id = this.studentId();
    if (!id) {
      this.error.set('Invalid student ID');
      this.loading.set(false);
      return;
    }
    this.loadStudent(id);
  }

  loadStudent(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.studentsService.getStudentById(id).subscribe({
      next: (res) => {
        this.student.set(res.student);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load student');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  goBack(): void {
    this.router.navigate(['/school/students']);
  }
}
