// src/app/features/school/id-cards/id-card-management/id-card-management.component.ts

import { Component, OnInit, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IdCardService,
  IdCardListItem,
  IdCardData,
  IdCardHolderType,
  IdCardStatus,
} from '../../../../core/services/id-card.service';
import { IdCardPdfService } from '../../../../core/services/id-card-pdf.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IdCardPreviewComponent } from '../id-card-preview/id-card-preview';

@Component({
  selector: 'app-id-card-management',
  standalone: true,
  imports: [CommonModule, FormsModule, IdCardPreviewComponent],
  templateUrl: './id-card-management.html',
  styleUrl: './id-card-management.scss',
})
export class IdCardManagementComponent implements OnInit, AfterViewInit {
  cards: IdCardListItem[] = [];
  loading = true;

  // ── Filters ───────────────────────────────────────────────────────────────
  holderTypeFilter: IdCardHolderType | 'ALL' = 'ALL';
  statusFilter: IdCardStatus | 'ALL' = 'ALL';

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedIds = new Set<number>();

  // ── Print staging ─────────────────────────────────────────────────────────
  // Cards currently loaded with full data + rendered off-screen for capture.
  // Populated only when the user clicks "Print Selected" — kept separate
  // from the lightweight list view so the list itself stays fast.
  printQueue: IdCardData[] = [];
  printing = false;

  @ViewChildren(IdCardPreviewComponent) previewComponents!: QueryList<IdCardPreviewComponent>;

  constructor(
    private idCardService: IdCardService,
    private pdfService: IdCardPdfService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadCards();
  }

  ngAfterViewInit(): void {}

  loadCards(): void {
    this.loading = true;
    const filters: { holderType?: IdCardHolderType; status?: IdCardStatus } = {};
    if (this.holderTypeFilter !== 'ALL') filters.holderType = this.holderTypeFilter;
    if (this.statusFilter !== 'ALL') filters.status = this.statusFilter;

    this.idCardService.listCards(filters).subscribe({
      next: (res) => {
        this.cards = res.cards;
        this.loading = false;
      },
      error: () => {
        this.toast.error('Failed to load ID cards');
        this.loading = false;
      },
    });
  }

  onFilterChange(): void {
    this.selectedIds.clear();
    this.loadCards();
  }

  toggleSelect(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedIds.size === this.cards.length) {
      this.selectedIds.clear();
    } else {
      this.cards.forEach((c) => this.selectedIds.add(c.id));
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  revokeCard(card: IdCardListItem): void {
    const reason = window.prompt(`Reason for revoking ${card.holderName}'s card?`);
    if (!reason) return;

    this.idCardService.revokeCard(card.id, reason).subscribe({
      next: () => {
        this.toast.success('Card revoked');
        this.loadCards();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to revoke card'),
    });
  }

  reissueCard(card: IdCardListItem): void {
    this.idCardService.reissueCard(card.id).subscribe({
      next: () => {
        this.toast.success('Card reissued — new card generated');
        this.loadCards();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to reissue card'),
    });
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  // Two-phase flow: (1) fetch full IdCardData for the selected cards and
  // render them in an off-screen container so each gets a real DOM node;
  // (2) once Angular has rendered all of them, capture + assemble the PDF.
  // The short setTimeout is intentional — it yields one macrotask so
  // ngAfterViewInit-style rendering of the freshly-added preview components
  // completes (including their async QR generation) before capture begins.

  async printSelected(): Promise<void> {
    if (this.selectedIds.size === 0) {
      this.toast.error('Select at least one card to print');
      return;
    }

    this.printing = true;
    try {
      const res = await this.idCardService.getCardsDataBulk(Array.from(this.selectedIds)).toPromise();
      this.printQueue = res?.cards ?? [];

      // Wait for the off-screen preview components to render AND for each
      // one's async QR code generation to resolve before capturing.
      await this.waitForRender();
      await this.waitForQrCodes();

      const elements = this.previewComponents.map((p) => p.getCardElement());
      const fileName = `id-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
      await this.pdfService.exportBulkCards(elements, fileName);

      this.toast.success(`Exported ${elements.length} card(s) to PDF`);
    } catch (err) {
      this.toast.error('Failed to generate print PDF');
    } finally {
      this.printQueue = [];
      this.printing = false;
    }
  }

  async printSingle(cardListItem: IdCardListItem): Promise<void> {
    this.printing = true;
    try {
      const res = await this.idCardService.getCardData(cardListItem.id).toPromise();
      if (!res?.card) throw new Error('Card data not found');

      this.printQueue = [res.card];
      await this.waitForRender();
      await this.waitForQrCodes();

      const element = this.previewComponents.first.getCardElement();
      await this.pdfService.exportSingleCard(element, `${res.card.cardNumber}.pdf`);
    } catch {
      this.toast.error('Failed to generate card PDF');
    } finally {
      this.printQueue = [];
      this.printing = false;
    }
  }

  private waitForRender(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** QR generation inside IdCardPreviewComponent is async (canvas encode) —
   *  give it a brief window to complete. A fixed delay is simple and
   *  reliable here since QR encoding for a short URL string is consistently
   *  fast (single-digit milliseconds); this avoids wiring an event emitter
   *  through every preview instance just for this one synchronization point. */
  private waitForQrCodes(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 150));
  }
}
