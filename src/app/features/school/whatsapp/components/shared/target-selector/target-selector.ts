// target-selector.ts
import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BulkTargetType, TARGET_TYPE_LABELS } from '../../../types/whatsapp.types';
import { ApiService } from '../../../../../../core/services/api.service';

export interface ClassSection {
  id: number;
  label: string; // e.g. "Class 9 - A"
}

export interface TargetSelection {
  targetType: BulkTargetType;
  classSectionId?: number;
  phoneList?: string[];
}

const CLASS_SCOPED: BulkTargetType[] = ['CLASS_SECTION_PARENTS', 'CLASS_SECTION_STUDENTS'];
const PHONE_LIST_TYPE: BulkTargetType = 'CUSTOM_PHONE_LIST';

@Component({
  selector: 'app-target-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './target-selector.html',
  styleUrls: ['./target-selector.scss'],
})
export class TargetSelector implements OnInit {
  @Input() value: TargetSelection = { targetType: 'ALL_PARENTS' };
  @Output() selectionChange = new EventEmitter<TargetSelection>();
  @Output() validChange = new EventEmitter<boolean>();

  private api = inject(ApiService);

  classSections: ClassSection[] = [];
  isLoadingClasses = false;

  selectedTargetType: BulkTargetType = 'ALL_PARENTS';
  selectedClassSectionId: number | null = null;
  phoneListRaw = '';
  bulkTitle = '';

  readonly targetOptions: { value: BulkTargetType; label: string; description: string; icon: string }[] = [
    { value: 'ALL_PARENTS', label: 'All parents', description: 'Every active parent/guardian in the school', icon: 'ti-users' },
    { value: 'ALL_STUDENTS', label: 'All students', description: 'Every active student with a phone number', icon: 'ti-school' },
    { value: 'ALL_STAFF', label: 'All staff', description: 'All staff members (teachers, admin, etc.)', icon: 'ti-briefcase' },
    { value: 'CLASS_SECTION_PARENTS', label: 'Class section — parents', description: 'Parents of students in one class-section', icon: 'ti-users-group' },
    { value: 'CLASS_SECTION_STUDENTS', label: 'Class section — students', description: 'Students enrolled in one class-section', icon: 'ti-chalkboard' },
    { value: 'CUSTOM_PHONE_LIST', label: 'Custom phone list', description: 'Paste specific WhatsApp numbers', icon: 'ti-list' },
  ];

  ngOnInit(): void {
    this.selectedTargetType = this.value.targetType;
    this.loadClassSections();
  }

  private loadClassSections(): void {
    this.isLoadingClasses = true;
    this.api.get<any>('school/academics/class-sections').subscribe({
      next: (res) => {
        this.isLoadingClasses = false;
        if (res.success && res.classSections) {
          this.classSections = res.classSections.map((cs: any) => ({
            id: cs.id,
            label: `${cs.className} - ${cs.sectionName}`,
          }));
        }
      },
      error: () => { this.isLoadingClasses = false; },
    });
  }

  onTargetTypeChange(): void {
    this.selectedClassSectionId = null;
    this.phoneListRaw = '';
    this.emit();
  }

  onClassSectionChange(): void {
    this.emit();
  }

  onPhoneListChange(): void {
    this.emit();
  }

  get needsClassSection(): boolean {
    return CLASS_SCOPED.includes(this.selectedTargetType);
  }

  get needsPhoneList(): boolean {
    return this.selectedTargetType === PHONE_LIST_TYPE;
  }

  get parsedPhones(): string[] {
    return this.phoneListRaw
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length >= 7);
  }

  get isValid(): boolean {
    if (!this.bulkTitle.trim()) return false;
    if (this.needsClassSection && !this.selectedClassSectionId) return false;
    if (this.needsPhoneList && this.parsedPhones.length === 0) return false;
    return true;
  }

  private emit(): void {
    const selection: TargetSelection = { targetType: this.selectedTargetType };
    if (this.needsClassSection && this.selectedClassSectionId) {
      selection.classSectionId = this.selectedClassSectionId;
    }
    if (this.needsPhoneList) {
      selection.phoneList = this.parsedPhones;
    }
    this.selectionChange.emit(selection);
    this.validChange.emit(this.isValid);
  }

  onTitleChange(): void {
    this.emit();
  }

  getBulkTitle(): string {
    return this.bulkTitle;
  }
}