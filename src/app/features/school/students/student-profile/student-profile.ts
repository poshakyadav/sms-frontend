// student-profile.ts
// Used by students who can view ONLY their own profile (students.view.own permission)

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { StudentsService, StudentDetail } from '../../../../core/services/students.service';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './student-profile.html',
  styleUrl: './student-profile.scss',
})
export class StudentProfile implements OnInit {
  private studentsService = inject(StudentsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  student = signal<StudentDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const userId = this.auth.schoolUser()?.id;
    if (!userId) {
      this.error.set('Could not determine your user ID.');
      this.loading.set(false);
      return;
    }
    this.loadProfile(userId);
  }

  loadProfile(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.studentsService.getStudentById(id).subscribe({
      next: (res) => {
        this.student.set(res.student);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load your profile');
        this.toast.error(this.error()!);
        this.loading.set(false);
      },
    });
  }

  /**
   * Build a comma-joined address string in the component (TypeScript) so the
   * template never calls Array.prototype.filter(Boolean) — which Angular's
   * compiler misreads as referencing a component property named "Boolean".
   */
  getAddress(student: StudentDetail): string {
    return [
      student.addressLineOne,
      student.addressLineTwo,
      student.city,
      student.state,
      student.postalCode,
    ]
      .filter((part): part is string => !!part)
      .join(', ');
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
