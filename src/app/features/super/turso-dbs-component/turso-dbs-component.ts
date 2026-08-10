// features/super/turso-dbs-component/turso-dbs-component.ts

import {
  Component,
  signal,
  computed,
  inject,
  afterNextRender,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

export interface TursoDB {
  id: number;
  url: string;
  authTokenPreview: string;
  createdByEmail: string;
  lastMigrationAt: string | null;
  isAssigned: boolean;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-turso-dbs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './turso-dbs-component.html',
  styleUrl: './turso-dbs-component.scss',
})
export class TursoDbsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly dbs = signal<TursoDB[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly availableCount = computed(
    () => this.dbs().filter((d) => !d.isAssigned).length
  );
  readonly assignedCount = computed(
    () => this.dbs().filter((d) => d.isAssigned).length
  );

  readonly displayedColumns = [
    'id',
    'url',
    'createdByEmail',
    'lastMigrationAt',
    'isAssigned',
    'actions',
  ] as const;

  readonly form = this.fb.group({
    url: ['', [Validators.required, Validators.pattern(/^libsql:\/\/.+/)]],
    authToken: ['', Validators.required],
    createdByEmail: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    afterNextRender(() => this.fetchDbs());
  }

  fetchDbs(): void {
    this.loading.set(true);
    this.api.get<TursoDB[]>('turso-dbs').subscribe({
      next: (res) => {
        this.dbs.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load databases');
        this.loading.set(false);
      },
    });
  }

  addDb(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.api.post('turso-dbs', this.form.value).subscribe({
      next: () => {
        this.toast.success('Database registered');
        this.form.reset();
        this.saving.set(false);
        this.fetchDbs();
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.error(err?.error?.error ?? 'Failed to add database');
        this.saving.set(false);
      },
    });
  }
}