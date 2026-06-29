// features/super/schools-component/schools-component.ts

import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  // ── State signals ─────────────────────────────────────────────────────────
  // Using a plain signal<School[]> instead of MatTableDataSource.
  // The template iterates with @for, which is signal-aware and re-renders
  // automatically when the signal changes — no ChangeDetectorRef needed.
  schools = signal<School[]>([]);
  loading = signal(false);
  unassigning = signal(false);
  error = signal<string | null>(null);

  // ── Derived state ─────────────────────────────────────────────────────────
  isEmpty = computed(() => !this.loading() && this.schools().length === 0);

  constructor() {
    // Mirror the dashboard pattern: defer the first load until after the
    // initial render so Angular's CD cycle is fully settled before we push
    // data into the template. This is the fix for the "click to render" bug.
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.fetchSchools();
      });
    }
  }

  ngOnInit(): void {
    // Intentionally empty — loading is deferred to afterNextRender above.
    // Keeping ngOnInit satisfies the OnInit interface contract for any future
    // lifecycle hooks that need to run at this stage (e.g. reactive input binding).
  }

  fetchSchools(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<School[] | { data: School[] }>('schools')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray((res as any)?.data)
              ? (res as any).data
              : [];

          this.schools.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load schools');
          this.toast.error('Failed to load schools');
          this.loading.set(false);
        },
      });
  }

  goToInvitations(): void {
    this.router.navigate(['/super/invitations']);
  }

  unassignDb(school: School): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: `Unassign the database from "${school.name}"? The school status will revert and they will need to go through the approval process again.`,
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.api
          .post<any>(`schools/${school.id}/unassign-db`, {})
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.success('Database unassigned');
              this.fetchSchools();
            },
            error: (err: any) =>
              this.toast.error(err?.error?.error ?? 'Failed to unassign database'),
          });
      });
  }

  cleanupOrphanDbs(): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: 'Scan and free all orphaned databases not assigned to any school?',
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.unassigning.set(true);
        this.api
          .post<any>('schools/unassign-unused-dbs', {})
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              this.toast.success(res?.message ?? 'Orphaned databases freed');
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
    return STATUS_MAP[status] ?? { label: status, cls: 'status--gray' };
  }

  nameInitial(name: unknown): string {
    if (typeof name !== 'string' || !name) return '?';
    return name.charAt(0).toUpperCase();
  }

  trackBySchoolId(_index: number, school: School): number {
    return school.id;
  }
}