// template-picker.ts
import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateDefinition, WhatsappTemplate, TEMPLATE_CATEGORY_LABELS } from '../../../types/whatsapp.types';

export interface TemplatePickerItem {
  definition: TemplateDefinition;
  cached?: WhatsappTemplate;
}

@Component({
  selector: 'app-template-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-picker.html',
  styleUrls: ['./template-picker.scss'],
})
export class TemplatePicker {
  @Input() items: TemplatePickerItem[] = [];
  @Input() selectedKey: string | null = null;
  @Output() templateSelected = new EventEmitter<TemplateDefinition>();

  searchQuery = '';

  get filteredItems(): TemplatePickerItem[] {
    if (!this.searchQuery.trim()) return this.items;
    const q = this.searchQuery.toLowerCase();
    return this.items.filter(
      (item) =>
        item.definition.description.toLowerCase().includes(q) ||
        item.definition.key.toLowerCase().includes(q) ||
        item.definition.name.toLowerCase().includes(q)
    );
  }

  select(item: TemplatePickerItem): void {
    if (item.cached && item.cached.status !== 'APPROVED') return;
    this.templateSelected.emit(item.definition);
  }

  getStatusClass(item: TemplatePickerItem): string {
    const status = item.cached?.status;
    if (!status || status === 'APPROVED') return 'approved';
    if (status === 'PENDING') return 'pending';
    return 'rejected';
  }

  getStatusLabel(item: TemplatePickerItem): string {
    const status = item.cached?.status;
    if (!status) return 'Not synced';
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  isSelectable(item: TemplatePickerItem): boolean {
    if (!item.cached) return false;
    return item.cached.status === 'APPROVED';
  }

  categoryLabel(cat: string): string {
    return TEMPLATE_CATEGORY_LABELS[cat as keyof typeof TEMPLATE_CATEGORY_LABELS] ?? cat;
  }

  trackByKey(_: number, item: TemplatePickerItem): string {
    return item.definition.key;
  }
}