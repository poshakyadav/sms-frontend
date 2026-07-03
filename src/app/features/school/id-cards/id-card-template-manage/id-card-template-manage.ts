// src/app/features/school/id-cards/id-card-template-manage/id-card-template-manage.ts
import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IdCardService,
  IdCardHolderType,
  IdCardTemplate,
  IdCardLayoutConfig,
  IdCardData,
} from '../../../../core/services/id-card.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { IdCardPreviewComponent } from '../id-card-preview/id-card-preview';
import { MatIcon } from "@angular/material/icon";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD CATALOG — every possible detailsSnapshot key, which holder type(s)
// it applies to, and its friendly label. Drives the field-chips UI.
// ─────────────────────────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  appliesTo: IdCardHolderType[];
}

const FIELD_DEFS: FieldDef[] = [
  { key: 'className', label: 'Class', appliesTo: ['STUDENT'] },
  { key: 'sectionName', label: 'Section', appliesTo: ['STUDENT'] },
  { key: 'rollNumber', label: 'Roll No.', appliesTo: ['STUDENT'] },
  { key: 'admissionNumber', label: 'Admission No.', appliesTo: ['STUDENT'] },
  { key: 'designation', label: 'Designation', appliesTo: ['STAFF'] },
  { key: 'department', label: 'Department', appliesTo: ['STAFF'] },
  { key: 'employeeCode', label: 'Employee Code', appliesTo: ['STAFF'] },
  { key: 'bloodGroup', label: 'Blood Group', appliesTo: ['STUDENT', 'STAFF'] },
  { key: 'dateOfBirth', label: 'Date of Birth', appliesTo: ['STUDENT', 'STAFF'] },
];

const DEFAULT_VISIBLE_FIELDS: Record<IdCardHolderType, string[]> = {
  STUDENT: ['className', 'sectionName', 'rollNumber'],
  STAFF: ['designation', 'department'],
};

const ACCENT_PRESETS = ['#4f46e5', '#0ea5e9', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0f172a'];

const DEFAULT_LAYOUT: IdCardLayoutConfig = {
  accentColor: '#4f46e5',
  accentTextColor: '#ffffff',
  backgroundColor: '#ffffff',
  showLogo: true,
  showTagline: true,
  visibleFields: DEFAULT_VISIBLE_FIELDS.STUDENT,
  footerNote: '',
  qrSizeRatio: 0.2,
  orientation: 'horizontal',
};

interface TemplateForm {
  name: string;
  holderType: IdCardHolderType;
  layoutConfig: IdCardLayoutConfig;
  isDefault: boolean;
}

// ── Dummy holder data used to render the live preview ─────────────────────
const DUMMY: Record<IdCardHolderType, { name: string; details: Record<string, string> }> = {
  STUDENT: {
    name: 'Aarav Sharma',
    details: {
      className: 'Class 8',
      sectionName: 'A',
      rollNumber: '17',
      admissionNumber: 'ADM-2451',
      bloodGroup: 'B+',
      dateOfBirth: '2012-05-14',
    },
  },
  STAFF: {
    name: 'Priya Verma',
    details: {
      designation: 'Mathematics Teacher',
      department: 'Science Wing',
      employeeCode: 'EMP-1029',
      bloodGroup: 'O+',
      dateOfBirth: '1990-03-02',
    },
  },
};

@Component({
  selector: 'app-id-card-template-manage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IdCardPreviewComponent, MatIcon],
  templateUrl: './id-card-template-manage.html',
  styleUrl: './id-card-template-manage.scss',
})
export class IdCardTemplateManageComponent {
  private idCardService = inject(IdCardService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  readonly accentPresets = ACCENT_PRESETS;

  // ── List state ────────────────────────────────────────────────────────────
  holderTypeFilter = signal<IdCardHolderType>('STUDENT');

  private templatesResource = rxResource({
    params: () => ({ holderType: this.holderTypeFilter() }),
    stream: ({ params }) => this.idCardService.listTemplates(params.holderType),
  });
  templates = computed(() => this.templatesResource.value()?.templates ?? []);
  loading = computed(() => this.templatesResource.isLoading());

  // ── Editor state ─────────────────────────────────────────────────────────
  showForm = signal(false);
  saving = signal(false);
  editingId = signal<number | null>(null);

  constructor() {
    // FIX: the holder-type tabs only ever drove the template LIST filter,
    // never the open editor form — so switching tabs while "New Template"
    // was open silently left the preview on the old holder type. This
    // keeps them in sync, but only while creating (editingId() === null);
    // if you're editing an existing template, tab switching should NOT
    // reassign its holder type out from under you.
    effect(() => {
      const type = this.holderTypeFilter();
      if (this.showForm() && this.editingId() === null) {
        this.onHolderTypeChange(type);
      }
    });
  }

  form = signal<TemplateForm>({
    name: '',
    holderType: 'STUDENT',
    layoutConfig: { ...DEFAULT_LAYOUT },
    isDefault: false,
  });

  availableFields = computed(() =>
    FIELD_DEFS.filter((f) => f.appliesTo.includes(this.form().holderType))
  );

  // ── Live preview — recomputes whenever `form` gets a NEW object via
  //    update()/set() (never via in-place mutation) ──────────────────────────
  previewCard = computed<IdCardData>(() => {
    const f = this.form();
    const dummy = DUMMY[f.holderType];
    const branding = this.auth.getStoredSchoolBranding();

    return {
      id: 0,
      cardNumber: 'PRV-2026-000001',
      holderType: f.holderType,
      holderName: dummy.name,
      photoUrl: null,
      details: dummy.details,
      issuedAt: new Date().toISOString(),
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      status: 'ACTIVE',
      verificationUrl: 'https://verify.example.com/preview-demo',
      template: {
        id: 0,
        name: f.name || 'Untitled Template',
        layoutConfig: f.layoutConfig,
      },
      school: {
        name: branding?.name || 'Greenwood International School',
        shortName: branding?.shortName ?? null,
        logoUrl: branding?.logoUrl ?? null,
        tagline: branding?.tagline ?? 'Excellence in Education',
        addressLineOne: branding?.addressLineOne || '123 Education Lane, Springfield',
        addressLineTwo: branding?.addressLineTwo || '',
        phone: branding?.phone || '+91 98765 43210',
      },
    };
  });

  // ── Form mutation helpers — ALWAYS produce a new object so computed()
  //    signals depending on `form()` correctly re-fire. Never mutate
  //    form().layoutConfig.xyz directly in the template. ─────────────────────

  updateField<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  updateLayout(patch: Partial<IdCardLayoutConfig>): void {
    this.form.update((f) => ({ ...f, layoutConfig: { ...f.layoutConfig, ...patch } }));
  }

  onHolderTypeChange(value: IdCardHolderType): void {
    const allowedKeys = FIELD_DEFS.filter((f) => f.appliesTo.includes(value)).map((f) => f.key);
    this.form.update((f) => ({
      ...f,
      holderType: value,
      layoutConfig: {
        ...f.layoutConfig,
        visibleFields: f.layoutConfig.visibleFields.filter((k) => allowedKeys.includes(k)),
      },
    }));
  }

  toggleField(field: string): void {
    const current = this.form().layoutConfig.visibleFields;
    const next = current.includes(field)
      ? current.filter((k) => k !== field)
      : [...current, field];
    this.updateLayout({ visibleFields: next });
  }

  isFieldChecked(field: string): boolean {
    return this.form().layoutConfig.visibleFields.includes(field);
  }

  // ── Panel open/close ────────────────────────────────────────────────────

  openCreate(): void {
    const holderType = this.holderTypeFilter();
    this.editingId.set(null);
    this.form.set({
      name: '',
      holderType,
      layoutConfig: { ...DEFAULT_LAYOUT, visibleFields: [...DEFAULT_VISIBLE_FIELDS[holderType]] },
      isDefault: this.templates().length === 0,
    });
    this.showForm.set(true);
  }

  openEdit(t: IdCardTemplate): void {
    this.editingId.set(t.id);
    this.form.set({
      name: t.name,
      holderType: t.holderType,
      layoutConfig: { ...t.layoutConfig, visibleFields: [...t.layoutConfig.visibleFields] },
      isDefault: t.isDefault,
    });
    this.showForm.set(true);
  }

  cancel(): void {
    this.showForm.set(false);
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.toast.error('Template name is required');
      return;
    }
    if (f.layoutConfig.visibleFields.length === 0) {
      this.toast.error('Select at least one visible field');
      return;
    }

    const id = this.editingId();
    this.saving.set(true);

    const onSuccess = () => {
      this.saving.set(false);
      this.toast.success(id ? 'Template updated' : 'Template created');
      this.showForm.set(false);
      this.templatesResource.reload();
    };
    const onError = (err: any) => {
      this.saving.set(false);
      this.toast.error(err?.error?.error || 'Failed to save template');
    };

    if (id) {
      this.idCardService.updateTemplate(id, f).subscribe({ next: onSuccess, error: onError });
    } else {
      this.idCardService.createTemplate(f).subscribe({ next: onSuccess, error: onError });
    }
  }

  remove(t: IdCardTemplate): void {
    if (!confirm(`Deactivate template "${t.name}"? It will stop appearing for new card generation, but existing issued cards are unaffected.`)) {
      return;
    }
    this.idCardService.deleteTemplate(t.id).subscribe({
      next: () => {
        this.toast.success('Template deactivated');
        if (this.editingId() === t.id) this.showForm.set(false);
        this.templatesResource.reload();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to deactivate template'),
    });
  }
}