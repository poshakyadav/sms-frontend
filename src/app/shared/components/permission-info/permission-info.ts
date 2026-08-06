// shared/components/permission-info/permission-info.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionRiskLevel } from '../../../core/services/roles.service';

export interface PermissionDisplayData {
  name: string;
  slug: string;
  description?: string;
  riskLevel?: PermissionRiskLevel;
  usedIn?: string[];
}

interface RiskMeta {
  label: string;
  cssClass: string;
}

// 'low' deliberately has no entry — no badge shown, keeps low-risk rows quiet.
const RISK_META: Partial<Record<PermissionRiskLevel, RiskMeta>> = {
  medium: { label: 'Use with care', cssClass: 'risk-medium' },
  high: { label: 'Sensitive', cssClass: 'risk-high' },
  critical: { label: 'Critical', cssClass: 'risk-critical' },
};

@Component({
  selector: 'app-permission-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './permission-info.html',
  styleUrl: './permission-info.scss',
})
export class PermissionInfo {
  @Input({ required: true }) permission!: PermissionDisplayData;
  @Input() showSlug = true;

  get riskMeta(): RiskMeta | null {
    const level = this.permission?.riskLevel;
    if (!level) return null;
    return RISK_META[level] ?? null;
  }
}