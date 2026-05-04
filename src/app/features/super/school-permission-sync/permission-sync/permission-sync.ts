// permission-sync.ts

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolRow {
  id: number;
  name: string;
  uniqueCode: string;
  isActive: boolean;
  onboardingStatus: string;
}

interface SyncResult {
  schoolCode: string;
  permissionsAdded: number;
  rolesAdded: number;
  roleLinksAdded: number;
  alreadyUpToDate: boolean;
  error?: string;
}

interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: SyncResult[];
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-permission-sync',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './permission-sync.html',
  styleUrl: './permission-sync.scss',
})
export class PermissionSync implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  // ── State ──────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal<string | null>(null);
  schools = signal<SchoolRow[]>([]);
  searchQuery = signal('');

  syncingSchoolCode = signal<string | null>(null);
  syncAllLoading = signal(false);

  /** Map of schoolCode → last SyncResult for that school */
  syncResults = signal<Map<string, SyncResult>>(new Map());
  batchResult = signal<BatchResult | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  filteredSchools = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.schools();
    return this.schools().filter(
      (s) => s.name.toLowerCase().includes(q) || s.uniqueCode.toLowerCase().includes(q)
    );
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSchools();
  }

  loadSchools(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<{ success: boolean; schools: SchoolRow[] }>('school-permissions-sync/status')
      .subscribe({
        next: (res) => {
          this.schools.set(res.schools ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load schools');
          this.loading.set(false);
        },
      });
  }

  // ── Single school sync ─────────────────────────────────────────────────────
  syncOne(schoolCode: string): void {
    if (this.syncingSchoolCode() || this.syncAllLoading()) return;

    this.syncingSchoolCode.set(schoolCode);

    this.api
      .post<{ success: boolean; result: SyncResult }>(
        `school-permissions-sync/sync/${schoolCode}`,
        {}
      )
      .subscribe({
        next: (res) => {
          this.syncingSchoolCode.set(null);

          if (res.success && res.result) {
            // Immutably update the map
            const updated = new Map(this.syncResults());
            updated.set(schoolCode, res.result);
            this.syncResults.set(updated);

            if (res.result.error) {
              this.toast.error(`Sync failed for ${schoolCode}: ${res.result.error}`);
            } else if (res.result.alreadyUpToDate) {
              this.toast.success(`${schoolCode} is already up to date`);
            } else {
              this.toast.success(
                `${schoolCode} synced: +${res.result.permissionsAdded} perms, ` +
                  `+${res.result.rolesAdded} roles, +${res.result.roleLinksAdded} links`
              );
            }
          }
        },
        error: (err) => {
          this.syncingSchoolCode.set(null);
          this.toast.error(
            `Sync failed for ${schoolCode}: ${err?.error?.error ?? 'Unknown error'}`
          );
        },
      });
  }

  // ── Batch sync ─────────────────────────────────────────────────────────────
  syncAll(): void {
    if (this.syncAllLoading() || this.syncingSchoolCode()) return;

    this.syncAllLoading.set(true);
    this.batchResult.set(null);

    this.api
      .post<{ success: boolean } & BatchResult>('school-permissions-sync/sync-all', {})
      .subscribe({
        next: (res) => {
          this.syncAllLoading.set(false);

          if (res.success) {
            this.batchResult.set({
              total: res.total,
              succeeded: res.succeeded,
              failed: res.failed,
              results: res.results,
            });

            // Merge individual results into the map
            const updated = new Map(this.syncResults());
            (res.results ?? []).forEach((r) => updated.set(r.schoolCode, r));
            this.syncResults.set(updated);

            if (res.failed > 0) {
              this.toast.error(`Batch complete with ${res.failed} failure(s).`);
            } else {
              this.toast.success(`All ${res.total} schools synced successfully.`);
            }
          }
        },
        error: (err) => {
          this.syncAllLoading.set(false);
          this.toast.error(err?.error?.error ?? 'Batch sync failed');
        },
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  clearBatch(): void {
    this.batchResult.set(null);
  }

  trackByCode(_: number, school: SchoolRow): string {
    return school.uniqueCode;
  }
}
