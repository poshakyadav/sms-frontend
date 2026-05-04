import { Component, signal, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  createdByEmail: string;
  lastMigrationAt: string | null;
  isAssigned: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-turso-dbs-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
export class TursoDbsComponent implements OnInit {
  dbs = signal<TursoDB[]>([]);
  displayedColumns = ['id', 'url', 'createdByEmail', 'lastMigrationAt', 'isAssigned'];
  loading = signal(false);
  saving = signal(false);

  form: FormGroup;

  availableCount = signal(0);
  assignedCount = signal(0);

  constructor(private api: ApiService, private fb: FormBuilder, private toast: ToastService) {
    this.form = fb.group({
      url: ['', [Validators.required, Validators.pattern(/^libsql:\/\/.+/)]],
      authToken: ['', Validators.required],
      createdByEmail: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit() {
    this.fetchDbs();
  }

  fetchDbs() {
    this.loading.set(true);
    this.api.get<TursoDB[]>('turso-dbs').subscribe({
      next: (res) => {
        this.dbs.set(res);
        this.availableCount.set(res.filter((d) => !d.isAssigned).length);
        this.assignedCount.set(res.filter((d) => d.isAssigned).length);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load databases');
        this.loading.set(false);
      },
    });
  }

  addDb() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.post('turso-dbs', this.form.value).subscribe({
      next: () => {
        this.toast.success('Database registered');
        this.form.reset();
        this.saving.set(false);
        this.fetchDbs();
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error ?? 'Failed to add database');
        this.saving.set(false);
      },
    });
  }
}
