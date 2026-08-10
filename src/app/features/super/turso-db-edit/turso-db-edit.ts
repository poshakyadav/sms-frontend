// features/super/turso-db-edit/turso-db-edit.ts

import { Component, inject, signal, computed, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface TursoDbDetail {
  id: number;
  url: string;
  authTokenPreview: string;
  isAssigned: boolean;
  createdByEmail: string;
  lastMigrationAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-turso-db-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './turso-db-edit.html',
  styleUrl: './turso-db-edit.scss',
})
export class TursoDbEdit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly notFound = signal(false);
  readonly record = signal<TursoDbDetail | null>(null);

  readonly form = this.fb.group({
    url: ['', [Validators.required, Validators.pattern(/^libsql:\/\/.+/)]],
    authToken: [''], // optional — blank keeps the existing token
    confirmReassign: [false],
  });

  // True only when the URL is actually changing — the dangerous case for
  // an already-assigned database.
  readonly urlChanged = computed(() => {
    const rec = this.record();
    return !!rec && this.form.controls.url.value?.trim() !== rec.url;
  });

  readonly requiresConfirmation = computed(
    () => !!this.record()?.isAssigned && this.urlChanged()
  );

  constructor() {
    afterNextRender(() => this.fetchRecord());
  }

  fetchRecord(): void {
    if (!this.id || Number.isNaN(this.id)) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.api.get<TursoDbDetail>(`turso-dbs/${this.id}`).subscribe({
      next: (res) => {
        this.record.set(res);
        this.form.patchValue({ url: res.url });
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.toast.error('Failed to load database');
        }
      },
    });
  }

  save(): void {
    const rec = this.record();
    if (!rec || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { url, authToken, confirmReassign } = this.form.value;
    const trimmedUrl = url?.trim() ?? '';
    const trimmedToken = authToken?.trim() ?? '';

    const payload: Record<string, unknown> = {};
    if (trimmedUrl && trimmedUrl !== rec.url) payload['url'] = trimmedUrl;
    if (trimmedToken) payload['authToken'] = trimmedToken;

    if (Object.keys(payload).length === 0) {
      this.toast.error('Change the URL or auth token before saving');
      return;
    }

    if (this.requiresConfirmation() && !confirmReassign) {
      this.toast.error('Please confirm you understand the impact on the assigned school');
      return;
    }

    if (this.requiresConfirmation()) {
      payload['force'] = true;
    }

    this.saving.set(true);
    this.api.patch(`turso-dbs/${this.id}`, payload).subscribe({
      next: () => {
        this.toast.success('Database updated');
        this.saving.set(false);
        this.router.navigate(['/super/turso-dbs']);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.error(err?.error?.error ?? 'Failed to update database');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/super/turso-dbs']);
  }
}