// features/super/schools-component/schools-component.ts
//
// Updated: The old "send invite" / "assign DB" buttons are removed.
// Invitations are now sent from the dedicated Invitations page (/super/invitations).
// This component is now purely a READ + utility page (view list, unassign DBs, cleanup).

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { HasSuperPermissionDirective } from '../../../core/directives/has-permission.directive';

export interface School {
  id: number;
  name: string;
  uniqueCode: string;
  email: string;
  addressLineOne: string;
  addressLineTwo?: string;
  phone: string;
  alternatePhone?: string;
  isActive: boolean;
  tursoDbId?: number;
  onboardingStatus?: string;
  activatedAt?: string;
  createdAt: string;
}

// Map onboardingStatus to a human-readable label + color class
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  INVITED: { label: 'Invited', cls: 'status--amber' },
  REGISTERED: { label: 'Registered', cls: 'status--blue' },
  PAYMENT_SUBMITTED: { label: 'Payment Submitted', cls: 'status--purple' },
  ACTIVE: { label: 'Active', cls: 'status--green' },
  SUSPENDED: { label: 'Suspended', cls: 'status--red' },
};

@Component({
  selector: 'app-schools-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    HasSuperPermissionDirective,
  ],
  templateUrl: './schools-component.html',
  styleUrl: './schools-component.scss',
})
export class SchoolsComponent implements OnInit {
  schools = signal<School[]>([]);
  displayedColumns = ['school', 'contact', 'code', 'status', 'db', 'actions'];
  loading = signal(false);
  unassigning = signal(false);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    this.fetchSchools();
  }

  fetchSchools() {
    this.loading.set(true);
    this.api.get<School[]>('schools').subscribe({
      next: (res) => {
        this.schools.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load schools');
        this.loading.set(false);
      },
    });
  }

  goToInvitations() {
    this.router.navigate(['/super/invitations']);
  }

  unassignDb(school: School) {
    const ref = this.dialog.open(ConfirmDialog, {
      data: `Unassign the database from "${school.name}"? The school status will revert and they will need to go through the approval process again.`,
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.post<any>(`schools/${school.id}/unassign-db`, {}).subscribe({
        next: () => {
          this.toast.success('Database unassigned');
          this.fetchSchools();
        },
        error: (err: any) => this.toast.error(err?.error?.error ?? 'Failed'),
      });
    });
  }

  cleanupOrphanDbs() {
    const ref = this.dialog.open(ConfirmDialog, {
      data: 'Scan and free all orphaned databases not assigned to any school?',
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.unassigning.set(true);
      this.api.post<any>('schools/unassign-unused-dbs', {}).subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.unassigning.set(false);
          this.fetchSchools();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.error ?? 'Cleanup failed');
          this.unassigning.set(false);
        },
      });
    });
  }

  getStatusInfo(status: string | undefined): { label: string; cls: string } {
    if (!status) return { label: 'Unknown', cls: 'status--gray' };
    return STATUS_MAP[status] || { label: status, cls: 'status--gray' };
  }

  nameInitial(name: unknown): string {
    if (typeof name !== 'string' || !name) return '?';
    return name.charAt(0).toUpperCase();
  }
}
