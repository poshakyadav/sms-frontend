// src/app/features/school/id-cards/id-card-generate-dialog/id-card-generate-dialog.component.ts
//
// NOTE — architecture change: this dialog no longer calls
// idCardService.generateCardsBulk() itself. Bulk generation (chunked, with
// real progress reporting) is now driven by IdCardManagementComponent via
// generateCardsBulkWithProgress(), which needs to stay alive across many
// requests and show a full-screen progress overlay — something this dialog
// can't do once it closes. So this dialog's job is now purely: collect
// holderType / classSection / template / validUntil / selected holders,
// then emit that raw payload via `generate` and let the parent close this
// dialog and take over. The pre-submission "this holder already has an
// active card — delete it first" flow stays here since it's independent of
// the generation call itself.

import { Component, computed, inject, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IdCardService,
  IdCardHolderType,
  EligibleHolder,
  GenerateBulkInput,
} from '../../../../core/services/id-card.service';
import { AcademicsService } from '../../../../core/services/academics.service';
import { ToastService } from '../../../../core/services/toast.service';
import { of } from 'rxjs';

interface HoldersQuery {
  holderType: IdCardHolderType;
  classSectionId: number | undefined;
}

@Component({
  selector: 'app-id-card-generate-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './id-card-generate-dialog.html',
  styleUrl: './id-card-generate-dialog.scss',
})
export class IdCardGenerateDialogComponent {
  private idCardService = inject(IdCardService);
  private academicsService = inject(AcademicsService);
  private toast = inject(ToastService);

  closed = output<void>();

  // CHANGED: was `generated = output<void>()`, emitted after this dialog
  // did the API call itself. Now emits the raw form payload — the parent
  // (IdCardManagementComponent.startBulkGeneration) owns the actual call.
  generate = output<GenerateBulkInput>();

  // ── Step state ────────────────────────────────────────────────────────
  holderType = signal<IdCardHolderType>('STUDENT');
  classSectionId = signal<number | null>(null);
  selectedTemplateId = signal<number | null>(null);
  validUntil = signal<string>('');
  selectedHolderIds = signal<Set<number>>(new Set());

  // REMOVED: submitting, resultSummary, retryingHolderId — these existed
  // to run generateCardsBulk() and show its result INSIDE this dialog.
  // That flow no longer happens here (see note above).

  // ── Inline "delete existing card" state (per holder row) ────────────────
  // UNCHANGED — this is a pre-submission step (freeing up a holder who
  // already has an active card), independent of the generation call.
  confirmDeleteUserId = signal<number | null>(null);
  deletingUserId = signal<number | null>(null);

  // ── Class-sections (only needed for STUDENT) ────────────────────────────
  private classSectionsResource = rxResource({
    params: () => (this.holderType() === 'STUDENT' ? {} : undefined),
    stream: () => this.academicsService.getClassSections(),
  });
  classSections = computed(() => this.classSectionsResource.value()?.classSections ?? []);

  // ── Templates for the selected holder type ──────────────────────────────
  private templatesResource = rxResource({
    params: () => ({ holderType: this.holderType() }),
    stream: ({ params }) => this.idCardService.listTemplates(params.holderType),
  });
  templates = computed(() => this.templatesResource.value()?.templates ?? []);

  // ── Eligible holders — waits for a class-section pick when STUDENT ─────
  private eligibleHoldersResource = rxResource<{ success: boolean; holders: EligibleHolder[] }, HoldersQuery | undefined>({
    params: () => {
      const ht = this.holderType();
      if (ht === 'STUDENT') {
        const csId = this.classSectionId();
        return csId ? { holderType: ht, classSectionId: csId } : undefined;
      }
      return { holderType: ht, classSectionId: undefined };
    },
    stream: ({ params }) => {
      if (!params) return of({ success: true, holders: [] });
      return this.idCardService.getEligibleHolders(params.holderType, params.classSectionId);
    },
    defaultValue: { success: true, holders: [] },
  });

  eligibleHolders = computed(() => this.eligibleHoldersResource.value()?.holders ?? []);
  loadingHolders = computed(() => this.eligibleHoldersResource.isLoading());

  // ── Handlers ─────────────────────────────────────────────────────────
  onHolderTypeChange(value: IdCardHolderType): void {
    this.holderType.set(value);
    this.classSectionId.set(null);
    this.selectedTemplateId.set(null);
    this.selectedHolderIds.set(new Set());
    this.confirmDeleteUserId.set(null);
  }

  onClassSectionChange(value: number): void {
    this.classSectionId.set(value);
    this.selectedHolderIds.set(new Set());
    this.confirmDeleteUserId.set(null);
  }

  toggleHolder(userId: number): void {
    // Guard against the checkbox's disabled state being bypassed by a
    // stray change event — holders with an active card are never selectable.
    const holder = this.eligibleHolders().find((h) => h.userId === userId);
    if (holder?.hasActiveCard) return;

    this.selectedHolderIds.update((set) => {
      const next = new Set(set);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  isHolderSelected(userId: number): boolean {
    return this.selectedHolderIds().has(userId);
  }

  selectAllWithoutCard(): void {
    const ids = this.eligibleHolders()
      .filter((h) => !h.hasActiveCard)
      .map((h) => h.userId);
    this.selectedHolderIds.set(new Set(ids));
  }

  clearSelection(): void {
    this.selectedHolderIds.set(new Set());
  }

  close(): void {
    this.closed.emit();
  }

  // ── Delete existing card (inline, from the holder picker) ───────────────
  // UNCHANGED

  requestDeleteExisting(userId: number): void {
    this.confirmDeleteUserId.set(userId);
  }

  cancelDeleteExisting(): void {
    if (this.deletingUserId() !== null) return;
    this.confirmDeleteUserId.set(null);
  }

  confirmDeleteExisting(holder: EligibleHolder): void {
    if (!holder.activeCardId) return;

    this.deletingUserId.set(holder.userId);
    this.idCardService.deleteCard(holder.activeCardId).subscribe({
      next: () => {
        this.toast.success(`Deleted existing card for ${holder.name}`);
        this.deletingUserId.set(null);
        this.confirmDeleteUserId.set(null);
        this.eligibleHoldersResource.reload();
      },
      error: (err) => {
        this.deletingUserId.set(null);
        this.toast.error(err?.error?.error || 'Failed to delete existing card');
      },
    });
  }

  // ── Submit — now just validates and emits the raw payload ──────────────
  // The parent (IdCardManagementComponent) closes this dialog and drives
  // the actual chunked generateCardsBulkWithProgress() call.

  submit(): void {
    const templateId = this.selectedTemplateId();
    const validUntil = this.validUntil();
    const holderIds = this.selectedHolderIds();

    if (!templateId) {
      this.toast.error('Select a template');
      return;
    }
    if (!validUntil) {
      this.toast.error('Select a valid-until date');
      return;
    }
    if (holderIds.size === 0) {
      this.toast.error('Select at least one holder');
      return;
    }

    const holdersList = this.eligibleHolders();
    const holders = Array.from(holderIds).map((holderUserId) => {
      if (this.holderType() === 'STUDENT') {
        const holder = holdersList.find((h) => h.userId === holderUserId);
        return { holderUserId, enrollmentId: holder?.enrollmentId };
      }
      return { holderUserId };
    });

    this.generate.emit({ templateId, validUntil, holders });
  }
}