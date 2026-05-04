// notifications-create.ts
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import {
  AcademicsService,
  ClassSection,
  Enrollment,
} from '../../../../core/services/academics.service';
import {
  CreateNotificationDto,
  NotificationService,
  TargetType,
} from '../../../../core/services/notification.service';
import { ToastService } from '../../../../core/services/toast.service';

interface TargetOption {
  value: TargetType;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-notifications-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './notifications-create.html',
  styleUrl: './notifications-create.scss',
})
export class NotificationsCreate implements OnInit {
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);
  private router = inject(Router);

  form!: FormGroup;
  isSubmitting = signal(false);
  classSections = signal<ClassSection[]>([]);
  students = signal<Enrollment[]>([]);

  readonly targetTypeOptions: TargetOption[] = [
    {
      value: 'SCHOOL',
      label: 'Entire School',
      icon: 'school',
      description: 'All users in school',
    },
    {
      value: 'CLASS',
      label: 'Class / Section',
      icon: 'class',
      description: 'Specific class or section',
    },
    {
      value: 'STUDENT',
      label: 'Individual Student',
      icon: 'person',
      description: 'A single student',
    },
    {
      value: 'ALL_STAFF',
      label: 'All Staff',
      icon: 'groups',
      description: 'All staff members',
    },
    {
      value: 'INTERNAL_STAFF',
      label: 'Internal Staff',
      icon: 'badge',
      description: 'Teachers & academic staff',
    },
    {
      value: 'OPERATION_STAFF',
      label: 'Operations Staff',
      icon: 'engineering',
      description: 'Admin & support staff',
    },
    {
      value: 'STUDENT_PARENT',
      label: 'Parents',
      icon: 'family_restroom',
      description: 'Parents of class students',
    },
    {
      value: 'EXTERNAL_USER',
      label: 'External Users',
      icon: 'people_outline',
      description: 'External class stakeholders',
    },
  ];

  // Computed: which target type is currently selected
  get selectedTarget(): TargetType {
    return this.form?.get('targetType')?.value as TargetType;
  }

  get needsClassSection(): boolean {
    return ['CLASS', 'EXTERNAL_USER', 'STUDENT_PARENT'].includes(this.selectedTarget);
  }

  get needsStudent(): boolean {
    return this.selectedTarget === 'STUDENT';
  }

  ngOnInit(): void {
    this.initForm();
    this.loadDropdownData();
  }

  private initForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      message: ['', [Validators.required, Validators.minLength(10)]],
      targetType: ['SCHOOL', Validators.required],
      classSectionId: [null],
      studentId: [null],
      dueDate: [null],
      link: [''],
    });

    // Dynamic validators on targetType change
    this.form.get('targetType')?.valueChanges.subscribe((type: TargetType) => {
      const classCtrl = this.form.get('classSectionId');
      const studentCtrl = this.form.get('studentId');

      classCtrl?.clearValidators();
      studentCtrl?.clearValidators();

      if (['CLASS', 'EXTERNAL_USER', 'STUDENT_PARENT'].includes(type)) {
        classCtrl?.setValidators([Validators.required]);
      }
      if (type === 'STUDENT') {
        studentCtrl?.setValidators([Validators.required]);
      }

      classCtrl?.updateValueAndValidity();
      studentCtrl?.updateValueAndValidity();
    });
  }

  private loadDropdownData(): void {
    this.academicsService.getClassSections().subscribe({
      next: (res) => this.classSections.set(res.classSections ?? []),
      error: () => this.toast.error('Failed to load class sections'),
    });

    this.academicsService.getEnrollments().subscribe({
      next: (res) => this.students.set(res.enrollments ?? []),
      error: () => this.toast.error('Failed to load students'),
    });
  }

  selectTargetType(value: TargetType): void {
    this.form.get('targetType')?.setValue(value);
    // Reset dependent fields
    this.form.get('classSectionId')?.reset();
    this.form.get('studentId')?.reset();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fill in all required fields');
      return;
    }

    this.isSubmitting.set(true);

    const val = this.form.value;
    const data: CreateNotificationDto = {
      title: val.title.trim(),
      message: val.message.trim(),
      targetType: val.targetType,
      classSectionId: val.classSectionId || undefined,
      studentId: val.studentId || undefined,
      dueDate: val.dueDate ? new Date(val.dueDate).toISOString().split('T')[0] : undefined,
      link: val.link?.trim() || undefined,
    };

    this.notificationService.createNotification(data).subscribe({
      next: () => this.router.navigate(['/school/notifications']),
      error: () => this.isSubmitting.set(false),
      complete: () => this.isSubmitting.set(false),
    });
  }

  onCancel(): void {
    if (this.form.dirty && !confirm('You have unsaved changes. Discard and go back?')) {
      return;
    }
    this.router.navigate(['/school/notifications']);
  }
}
