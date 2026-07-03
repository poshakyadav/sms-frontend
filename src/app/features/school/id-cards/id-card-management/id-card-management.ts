// src/app/features/school/id-cards/id-card-management/id-card-management.component.ts

import {
  Component,
  computed,
  inject,
  Injector,
  signal,
  viewChildren,
  afterNextRender,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IdCardService,
  IdCardListItem,
  IdCardData,
  IdCardHolderType,
  IdCardStatus,
  DeleteBulkResult,
  BulkGenerationProgress,
  GenerateBulkInput,
} from '../../../../core/services/id-card.service';
import { AcademicsService } from '../../../../core/services/academics.service';
import { IdCardPdfService } from '../../../../core/services/id-card-pdf.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IdCardPreviewComponent } from '../id-card-preview/id-card-preview';
import { IdCardGenerateDialogComponent } from '../id-card-generate-dialog/id-card-generate-dialog';
import { RouterLink } from '@angular/router';
import { ImageDataUrlService } from '../../../../core/services/image-data-url.service';

interface CardsQuery {
  holderType: IdCardHolderType | 'ALL';
  status: IdCardStatus | 'ALL';
  classSectionId: number | 'ALL';
}

@Component({
  selector: 'app-id-card-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IdCardPreviewComponent, IdCardGenerateDialogComponent],
  templateUrl: './id-card-management.html',
  styleUrl: './id-card-management.scss',
})
export class IdCardManagementComponent {
  private idCardService = inject(IdCardService);
  private academicsService = inject(AcademicsService);
  private pdfService = inject(IdCardPdfService);
  private toast = inject(ToastService);
  private injector = inject(Injector);
  private imageDataUrlService = inject(ImageDataUrlService);

  // ── Filters (signals — the single source of truth) ──────────────────────
  holderTypeFilter = signal<IdCardHolderType | 'ALL'>('ALL');
  statusFilter = signal<IdCardStatus | 'ALL'>('ALL');
  classSectionFilter = signal<number | 'ALL'>('ALL');

  // ── Bulk generation progress ─────────────────────────────────────────────
  generating = signal(false);
  generationProgress = signal(0);
  generationStats = signal<{ completed: number; total: number; succeeded: number; failed: number } | null>(null);

  showClassSectionFilter = computed(() => this.holderTypeFilter() === 'STUDENT');

  private classSectionsResource = rxResource({
    params: () => (this.showClassSectionFilter() ? {} : undefined),
    stream: () => this.academicsService.getClassSections(),
  });
  classSections = computed(() => this.classSectionsResource.value()?.classSections ?? []);

  private cardsResource = rxResource<{ success: boolean; cards: IdCardListItem[] }, CardsQuery>({
    params: () => ({
      holderType: this.holderTypeFilter(),
      status: this.statusFilter(),
      classSectionId: this.classSectionFilter(),
    }),
    stream: ({ params }) => {
      const filters: { holderType?: IdCardHolderType; status?: IdCardStatus; classSectionId?: number } = {};
      if (params.holderType !== 'ALL') filters.holderType = params.holderType;
      if (params.status !== 'ALL') filters.status = params.status;
      if (params.holderType === 'STUDENT' && params.classSectionId !== 'ALL') {
        filters.classSectionId = params.classSectionId;
      }
      return this.idCardService.listCards(filters);
    },
    defaultValue: { success: true, cards: [] },
  });

  cards = computed(() => this.cardsResource.value()?.cards ?? []);
  loading = computed(() => this.cardsResource.isLoading());

  onHolderTypeChange(value: IdCardHolderType | 'ALL'): void {
    this.holderTypeFilter.set(value);
    this.classSectionFilter.set('ALL');
    this.selectedIds.set(new Set());
  }

  onClassSectionChange(value: number | 'ALL'): void {
    this.classSectionFilter.set(value);
    this.selectedIds.set(new Set());
  }

  onStatusChange(value: IdCardStatus | 'ALL'): void {
    this.statusFilter.set(value);
    this.selectedIds.set(new Set());
  }

  // ── Selection ─────────────────────────────────────────────────────────
  selectedIds = signal<Set<number>>(new Set());

  toggleSelect(id: number): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    const all = this.cards();
    this.selectedIds.update((set) =>
      set.size === all.length ? new Set() : new Set(all.map((c) => c.id))
    );
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  // ── Generate Cards dialog ────────────────────────────────────────────
  showGenerateDialog = signal(false);

  openGenerateDialog(): void {
    this.showGenerateDialog.set(true);
  }

  onDialogClosed(): void {
    this.showGenerateDialog.set(false);
  }

  // ── Revoke / Reissue ─────────────────────────────────────────────────
  revokeCard(card: IdCardListItem): void {
    const reason = window.prompt(`Reason for revoking ${card.holderName}'s card?`);
    if (!reason) return;

    this.idCardService.revokeCard(card.id, reason).subscribe({
      next: () => {
        this.toast.success('Card revoked');
        this.cardsResource.reload();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to revoke card'),
    });
  }

  reissueCard(card: IdCardListItem): void {
    this.idCardService.reissueCard(card.id).subscribe({
      next: () => {
        this.toast.success('Card reissued — new card generated');
        this.cardsResource.reload();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to reissue card'),
    });
  }





  // ── Print ────────────────────────────────────────────────────────────
  printQueue = signal<IdCardData[]>([]);
  printing = signal(false);
  printProgress = signal(0);
  printStats = signal<{ completed: number; total: number } | null>(null);

  // Small chunk size bounds how many cards are ever rendered in the DOM
  // at once. Raster cost is now negligible (SnapDOM), so this is sized
  // for Angular render + photo-fetch cost, not capture cost — safe to
  // raise further if you profile headroom; 10 is a solid default step up
  // from the old html2canvas-era 6.
  private readonly PRINT_CHUNK_SIZE = 10;

  private previewComponents = viewChildren(IdCardPreviewComponent);

  private async fetchAllCardData(ids: number[]): Promise<IdCardData[]> {
    const PAGE_SIZE = 150;
    const all: IdCardData[] = [];
    for (let i = 0; i < ids.length; i += PAGE_SIZE) {
      const page = ids.slice(i, i + PAGE_SIZE);
      const res = await this.idCardService.getCardsDataBulk(page).toPromise();
      all.push(...(res?.cards ?? []));
    }
    return all;
  }


   private async renderPrintChunk(
    chunk: IdCardData[]
  ): Promise<{ elements: HTMLElement[]; cleanup: () => void }> {
  
    // NEW — resolve all photo/logo URLs for this chunk FIRST, deterministically,
    // before Angular ever creates the preview components. Same fetch→blob→FileReader
    // technique as before, just called imperatively instead of via a reactive effect.
    const urls = new Set<string>();
    for (const card of chunk) {
      if (card.photoUrl) urls.add(card.photoUrl);
      if (card.school.logoUrl) urls.add(card.school.logoUrl);
    }
    await Promise.allSettled(
      Array.from(urls).map((u) => this.imageDataUrlService.resolve(u))
    );
    // By the time printQueue is set below, ImageDataUrlService's cache is already
    // warm for this chunk — the component's effect() will resolve near-instantly
    // from cache instead of racing a live network fetch against whenReady().
  
    this.printQueue.set(chunk);
    await this.waitForRender();
  
    const previews = this.previewComponents();
    await Promise.all(
      previews.map((p) =>
        Promise.race([p.whenReady(), new Promise<void>((resolve) => setTimeout(resolve, 8000))])
      )
    );
  
    const elements = previews.map((p) => p.getCardElement());
    return { elements, cleanup: () => {} };
  }


  async printSelected(): Promise<void> {
    if (this.selectedIds().size === 0) {
      this.toast.error('Select at least one card to print');
      return;
    }

    const ids = Array.from(this.selectedIds());
    this.printing.set(true);
    this.printProgress.set(0);
    this.printStats.set({ completed: 0, total: ids.length });

    try {
      const allCards = await this.fetchAllCardData(ids);
      if (allCards.length === 0) throw new Error('No card data found');

      const fileName = `id-cards-${new Date().toISOString().slice(0, 10)}.pdf`;

      await this.pdfService.exportBulkCardsChunked(
        allCards,
        this.PRINT_CHUNK_SIZE,
        (chunk) => this.renderPrintChunk(chunk),
        fileName,
        (completed, total) => {
          this.printProgress.set(Math.round((completed / total) * 100));
          this.printStats.set({ completed, total });
        }
      );

      this.toast.success(`Exported ${allCards.length} card(s) to PDF`);
    } catch (err) {
      console.error('[ID-CARD PRINT] Bulk export failed:', err);
      this.toast.error('Failed to generate print PDF');
    } finally {
      this.printQueue.set([]);
      this.printing.set(false);
      this.printStats.set(null);
    }
  }

  async printSingle(cardListItem: IdCardListItem): Promise<void> {
    this.printing.set(true);
    try {
      const res = await this.idCardService.getCardData(cardListItem.id).toPromise();
      if (!res?.card) throw new Error('Card data not found');
  
      this.printQueue.set([res.card]);
      await this.waitForRender();
  
      const preview = this.previewComponents()[0];
      await Promise.race([preview.whenReady(), new Promise<void>((resolve) => setTimeout(resolve, 8000))]);
      const element = preview.getCardElement();
  
      await this.pdfService.exportSingleCard(element, `${res.card.cardNumber}.pdf`);
    } catch {
      this.toast.error('Failed to generate card PDF');
    } finally {
      this.printQueue.set([]);
      this.printing.set(false);
    }
  }

  private waitForRender(): Promise<void> {
    return new Promise((resolve) => {
      afterNextRender(() => resolve(), { injector: this.injector });
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // ── Delete (single card) ────────────────────────────────────────────────
  cardPendingDelete = signal<IdCardListItem | null>(null);
  deletingCard = signal(false);

  requestDelete(card: IdCardListItem): void {
    this.cardPendingDelete.set(card);
  }

  cancelDelete(): void {
    if (this.deletingCard()) return;
    this.cardPendingDelete.set(null);
  }

  confirmDelete(): void {
    const card = this.cardPendingDelete();
    if (!card) return;

    this.deletingCard.set(true);
    this.idCardService.deleteCard(card.id).subscribe({
      next: () => {
        this.toast.success('Card deleted');
        this.deletingCard.set(false);
        this.cardPendingDelete.set(null);
        this.selectedIds.update((set) => {
          const next = new Set(set);
          next.delete(card.id);
          return next;
        });
        this.cardsResource.reload();
      },
      error: (err) => {
        this.deletingCard.set(false);
        this.toast.error(err?.error?.error || 'Failed to delete card');
      },
    });
  }

  // ── Delete — Bulk ────────────────────────────────────────────────────────
  showBulkDeleteConfirm = signal(false);
  deletingBulk = signal(false);

  selectedCardItems = computed(() =>
    this.cards().filter((c) => this.selectedIds().has(c.id))
  );

  selectedActiveCount = computed(
    () => this.selectedCardItems().filter((c) => c.status === 'ACTIVE').length
  );

  requestBulkDelete(): void {
    if (this.selectedIds().size === 0) return;
    this.showBulkDeleteConfirm.set(true);
  }

  cancelBulkDelete(): void {
    if (this.deletingBulk()) return;
    this.showBulkDeleteConfirm.set(false);
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.deletingBulk.set(true);
    this.idCardService.deleteCardsBulk(ids).subscribe({
      next: (res: { success: boolean; message: string } & DeleteBulkResult) => {
        this.deletingBulk.set(false);
        this.showBulkDeleteConfirm.set(false);

        if (res.notFound.length > 0) {
          this.toast.error(
            `Deleted ${res.deletedCount} card(s). ${res.notFound.length} were already removed.`
          );
        } else {
          this.toast.success(`Deleted ${res.deletedCount} card(s)`);
        }

        this.selectedIds.set(new Set());
        this.cardsResource.reload();
      },
      error: (err) => {
        this.deletingBulk.set(false);
        this.toast.error(err?.error?.error || 'Failed to delete selected cards');
      },
    });
  }

  startBulkGeneration(data: GenerateBulkInput): void {
    this.showGenerateDialog.set(false);
    this.generating.set(true);
    this.generationProgress.set(0);
    this.generationStats.set({ completed: 0, total: data.holders.length, succeeded: 0, failed: 0 });

    this.idCardService
      .generateCardsBulkWithProgress(data, (progress: BulkGenerationProgress) => {
        this.generationProgress.set(progress.percent);
        this.generationStats.set({
          completed: progress.completed,
          total: progress.total,
          succeeded: progress.succeededSoFar,
          failed: progress.failedSoFar,
        });
      })
      .subscribe({
        next: (res) => {
          this.generating.set(false);
          if (res.failedCount > 0) {
            this.toast.error(`Generated ${res.generatedCount} card(s). ${res.failedCount} failed.`);
          } else {
            this.toast.success(`Generated ${res.generatedCount} card(s)`);
          }
          this.cardsResource.reload();
        },
        error: () => {
          this.generating.set(false);
          this.toast.error('Failed to generate cards');
        },
      });
  }
}