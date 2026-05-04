// src/app/features/public/school-registration/school-registration.ts

import { CommonModule } from '@angular/common';
import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';

interface RegistrationForm {
  schoolName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  city: string;
  state: string;
  schoolType: string;
  estimatedStudents: string;
  message: string;
  agreed: boolean;
}

@Component({
  selector: 'app-school-registration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './school-registration.html',
  styleUrl: './school-registration.scss',
})
export class SchoolRegistration {
  private api = inject(ApiService);

  // UI state
  showForm = signal(false);
  loading = signal(false);
  submitted = signal(false);
  errorMsg = signal('');

  // Form state
  form: RegistrationForm = {
    schoolName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    city: '',
    state: '',
    schoolType: '',
    estimatedStudents: '',
    message: '',
    agreed: false,
  };

  readonly schoolTypes = [
    { value: 'PRIMARY', label: 'Primary School (Classes 1–5)' },
    { value: 'SECONDARY', label: 'Secondary School (Classes 6–10)' },
    { value: 'HIGHER_SECONDARY', label: 'Higher Secondary (Classes 11–12)' },
    { value: 'OTHER', label: 'Other / Combined' },
  ];

  readonly features = [
    {
      icon: 'how_to_reg',
      title: 'Student Enrollment',
      desc: 'Manage admissions and class assignments effortlessly.',
    },
    {
      icon: 'fact_check',
      title: 'Attendance Tracking',
      desc: 'Daily attendance with reports and analytics.',
    },
    {
      icon: 'assignment',
      title: 'Exams & Assignments',
      desc: 'Marks entry, report cards, and admit cards.',
    },
    {
      icon: 'payments',
      title: 'Fee Management',
      desc: 'Fee structures, online collection, and ledgers.',
    },
    {
      icon: 'notifications_active',
      title: 'Smart Notifications',
      desc: 'Push announcements to students, parents, and staff.',
    },
    {
      icon: 'people',
      title: 'Multi-role Access',
      desc: 'Owner, teachers, accountants, parents — all in one app.',
    },
  ];

  readonly steps = [
    {
      num: '01',
      title: 'Submit Request',
      desc: 'Fill in your school details. Takes under 2 minutes.',
    },
    { num: '02', title: 'We Contact You', desc: 'Our team reaches out within 24–48 hours.' },
    { num: '03', title: 'Go Live', desc: 'After a quick onboarding call, your school is live.' },
  ];

  readonly indianStates = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Delhi',
    'Jammu & Kashmir',
    'Ladakh',
    'Puducherry',
    'Chandigarh',
    'Andaman & Nicobar',
    'Lakshadweep',
  ];

  openForm(): void {
    this.showForm.set(true);
    setTimeout(() => {
      document.getElementById('reg-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  isFormValid(): boolean {
    const f = this.form;
    return !!(
      f.schoolName.trim() &&
      f.ownerName.trim() &&
      f.ownerEmail.trim() &&
      f.ownerPhone.trim() &&
      f.city.trim() &&
      f.state &&
      f.schoolType &&
      f.agreed
    );
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    const payload: any = {
      schoolName: this.form.schoolName.trim(),
      ownerName: this.form.ownerName.trim(),
      ownerEmail: this.form.ownerEmail.trim().toLowerCase(),
      ownerPhone: this.form.ownerPhone.trim(),
      city: this.form.city.trim(),
      state: this.form.state,
      schoolType: this.form.schoolType,
    };

    if (this.form.estimatedStudents) {
      payload.estimatedStudents = parseInt(this.form.estimatedStudents);
    }
    if (this.form.message.trim()) {
      payload.message = this.form.message.trim();
    }

    try {
      await this.api.post('public/school-requests', payload).toPromise();
      this.submitted.set(true);
      this.showForm.set(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err?.status === 409) {
        this.errorMsg.set(
          'We already have a request from this email. Our team will contact you soon!'
        );
      } else {
        this.errorMsg.set(err?.error?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
