// features/school/students/udise/udise-profile-editor/udise-profile-editor.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  StudentUdiseService,
  UDISEStudentProfile,
  UpdateUDISEProfilePayload,
  SOCIAL_CATEGORY_LABELS,
  RELIGION_LABELS,
  DISABILITY_LABELS,
  FACILITY_LABELS,
  MOTHER_TONGUE_LABELS,
  FacilityReceived,
} from '../../../../../core/services/student-udise.service';
import { UdiseCompletenessBadge } from '../udise-completeness-badge/udise-completeness-badge';

type SectionKey = 'gp-identity' | 'gp-demographic' | 'ep' | 'sf';

@Component({
  selector: 'app-udise-profile-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    UdiseCompletenessBadge,
  ],
  template: `
    <div class="page-wrapper">
      <!-- Back + header -->
      <div class="editor-topbar">
        <button class="editor-back-btn" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          <span>UDISE Dashboard</span>
        </button>
      </div>

      <!-- Loading -->
      @if (loading()) {
      <div class="loading-overlay">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading UDISE profile…</p>
      </div>
      }

      <!-- Error -->
      @if (!loading() && error()) {
      <div class="editor-error">
        <mat-icon>error_outline</mat-icon>
        <h3>Could not load profile</h3>
        <p>{{ error() }}</p>
        <button class="editor-retry-btn" (click)="load()">
          <mat-icon>refresh</mat-icon> Retry
        </button>
      </div>
      }

      <!-- Main editor -->
      @if (!loading() && profile()) {
      <!-- Page header -->
      <div class="editor-header">
        <div class="editor-header__student">
          <div class="editor-avatar">{{ initials() }}</div>
          <div class="editor-header__info">
            <h1>{{ profile()!.name }}</h1>
            <div class="editor-header__meta">
              <span class="roll-chip">{{ profile()!.className }}-{{ profile()!.sectionName }}</span>
              <span class="cell-muted">{{ profile()!.academicYearName }}</span>
              @if (profile()!.admissionNumber) {
              <span class="cell-muted">Adm: {{ profile()!.admissionNumber }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Live completeness -->
        <div class="editor-header__completeness">
          <app-udise-completeness-badge
            [completeness]="profile()!.completeness"
            size="md"
            [showLabel]="true"
          ></app-udise-completeness-badge>
        </div>
      </div>

      <!-- Unsaved changes banner -->
      @if (isDirty()) {
      <div class="unsaved-banner">
        <mat-icon>edit_note</mat-icon>
        <span>You have unsaved changes</span>
        <div class="unsaved-banner__actions">
          <button class="unsaved-discard" (click)="discardChanges()">Discard</button>
          <button class="unsaved-save" (click)="save()" [disabled]="saving()">
            @if (saving()) { <mat-spinner diameter="14"></mat-spinner> }
            <mat-icon *ngIf="!saving()">save</mat-icon>
            {{ saving() ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
      }

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- SECTION: GP — National Identity                        -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div class="section-card" [class.section-card--open]="openSections['gp-identity']">
        <button class="udise-section-toggle" (click)="toggleSection('gp-identity')">
          <div class="udise-section-toggle__left">
            <div class="udise-section-badge udise-section-badge--blue">GP</div>
            <div>
              <div class="udise-section-toggle__title">General Profile — Identity</div>
              <div class="udise-section-toggle__sub">Aadhaar, PEN, APAAR, national & state IDs</div>
            </div>
          </div>
          <div class="udise-section-toggle__right">
            <span
              class="section-score-pill"
              [class.complete]="profile()!.completeness.gp.score === 100"
              >GP {{ profile()!.completeness.gp.score }}%</span
            >
            <mat-icon class="udise-chevron" [class.open]="openSections['gp-identity']">
              expand_more
            </mat-icon>
          </div>
        </button>

        @if (openSections['gp-identity']) {
        <div class="section-body">
          <!-- Sub-header: Parental -->
          <div class="subsection-header">
            <mat-icon>family_restroom</mat-icon>
            Parental / Guardian Details
          </div>
          <div class="form-grid-2">
            <div class="editor-field">
              <label>Father's Name</label>
              <input
                [(ngModel)]="form.fatherName"
                (ngModelChange)="markDirty()"
                placeholder="Father's full name"
              />
            </div>
            <div class="editor-field">
              <label>Mother's Name</label>
              <input
                [(ngModel)]="form.motherName"
                (ngModelChange)="markDirty()"
                placeholder="Mother's full name"
              />
            </div>
            <div class="editor-field">
              <label>Guardian's Name <span class="optional-label">(if different)</span></label>
              <input
                [(ngModel)]="form.guardianName"
                (ngModelChange)="markDirty()"
                placeholder="Guardian name"
              />
            </div>
            <div class="editor-field">
              <label>Guardian Relation</label>
              <input
                [(ngModel)]="form.guardianRelation"
                (ngModelChange)="markDirty()"
                placeholder="e.g. Uncle, Grandparent"
              />
            </div>
          </div>

          <!-- Sub-header: National IDs -->
          <div class="subsection-header">
            <mat-icon>badge</mat-icon>
            National Identity Numbers
          </div>

          <div class="info-card info-card--amber" style="margin-bottom:16px">
            <mat-icon>security</mat-icon>
            <p>
              Store only the <strong>last 4 digits</strong> of Aadhaar in masked format. Full
              Aadhaar numbers must never be stored in school records.
            </p>
          </div>

          <div class="form-grid-2">
            <div class="editor-field">
              <label>
                PEN
                <span class="field-hint">16-digit Permanent Education Number</span>
              </label>
              <input
                [(ngModel)]="form.pen"
                (ngModelChange)="markDirty()"
                placeholder="1234567890123456"
                maxlength="16"
                pattern="d{16}"
              />
              <div
                class="field-validation"
                *ngIf="form.pen && form.pen.length > 0 && form.pen.length !== 16"
              >
                PEN must be exactly 16 digits
              </div>
            </div>
            <div class="editor-field">
              <label>
                APAAR ID
                <span class="field-hint">12-digit Academic Bank of Credits ID</span>
              </label>
              <input
                [(ngModel)]="form.apaarId"
                (ngModelChange)="markDirty()"
                placeholder="123456789012"
                maxlength="12"
              />
              <div
                class="field-validation"
                *ngIf="form.apaarId && form.apaarId.length > 0 && form.apaarId.length !== 12"
              >
                APAAR ID must be exactly 12 digits
              </div>
            </div>
            <div class="editor-field">
              <label>
                Aadhaar (Masked)
                <span class="field-hint">Format: XXXX XXXX 1234</span>
              </label>
              <input
                [(ngModel)]="form.aadhaarMasked"
                (ngModelChange)="markDirty()"
                placeholder="XXXX XXXX 1234"
                maxlength="14"
              />
            </div>
            <div class="editor-field">
              <label>Name as per Aadhaar</label>
              <input
                [(ngModel)]="form.aadhaarName"
                (ngModelChange)="markDirty()"
                placeholder="Full name on Aadhaar card"
              />
            </div>
            <div class="editor-field">
              <label>State Student ID</label>
              <input
                [(ngModel)]="form.stateStudentId"
                (ngModelChange)="markDirty()"
                placeholder="State-issued student ID"
              />
            </div>
            <div class="editor-field">
              <label>
                Prev. School UDISE Code
                <span class="field-hint">11-digit UDISE code</span>
              </label>
              <input
                [(ngModel)]="form.previousSchoolUdiseCode"
                (ngModelChange)="markDirty()"
                placeholder="09100401101"
                maxlength="11"
              />
            </div>
          </div>

          <!-- Aadhaar verified toggle -->
          <div class="editor-toggle-row">
            <div class="editor-toggle-info">
              <span class="editor-toggle-label">Aadhaar Verified</span>
              <span class="editor-toggle-hint">Mark when Aadhaar has been physically verified</span>
            </div>
            <button
              class="toggle-btn"
              [class.toggle-btn--on]="form.isAadhaarVerified"
              (click)="form.isAadhaarVerified = !form.isAadhaarVerified; markDirty()"
            >
              <mat-icon>{{ form.isAadhaarVerified ? 'verified' : 'pending' }}</mat-icon>
              {{ form.isAadhaarVerified ? 'Verified' : 'Not Verified' }}
            </button>
          </div>
        </div>
        }
      </div>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- SECTION: GP — Demographic                              -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div class="section-card" [class.section-card--open]="openSections['gp-demographic']">
        <button class="udise-section-toggle" (click)="toggleSection('gp-demographic')">
          <div class="udise-section-toggle__left">
            <div class="udise-section-badge udise-section-badge--blue">GP</div>
            <div>
              <div class="udise-section-toggle__title">General Profile — Demographics</div>
              <div class="udise-section-toggle__sub">
                Social category, religion, mother tongue, locality
              </div>
            </div>
          </div>
          <div class="udise-section-toggle__right">
            <span
              class="section-score-pill"
              [class.complete]="profile()!.completeness.gp.score === 100"
            >
              GP {{ profile()!.completeness.gp.score }}%
            </span>
            <mat-icon class="udise-chevron" [class.open]="openSections['gp-demographic']"
              >expand_more</mat-icon
            >
          </div>
        </button>

        @if (openSections['gp-demographic']) {
        <div class="section-body">
          <div class="form-grid-2">
            <!-- Social Category -->
            <div class="editor-field">
              <label>Social Category <span class="field-required">*</span></label>
              <select [(ngModel)]="form.socialCategory" (ngModelChange)="markDirty()">
                <option [ngValue]="null">— Select category —</option>
                @for (entry of socialCategoryOptions; track entry.code) {
                <option [ngValue]="entry.code">{{ entry.code }} — {{ entry.label }}</option>
                }
              </select>
            </div>

            <!-- Religion -->
            <div class="editor-field">
              <label>Religion <span class="field-required">*</span></label>
              <select [(ngModel)]="form.religion" (ngModelChange)="markDirty()">
                <option [ngValue]="null">— Select religion —</option>
                @for (entry of religionOptions; track entry.code) {
                <option [ngValue]="entry.code">{{ entry.code }} — {{ entry.label }}</option>
                }
              </select>
            </div>

            <!-- Mother Tongue -->
            <div class="editor-field">
              <label>Mother Tongue (Census Code)</label>
              <select [(ngModel)]="form.motherTongueCode" (ngModelChange)="markDirty()">
                <option [ngValue]="null">— Select language —</option>
                @for (entry of motherTongueOptions; track entry.code) {
                <option [ngValue]="entry.code">{{ entry.code }} — {{ entry.label }}</option>
                }
              </select>
            </div>

            <!-- Locality -->
            <div class="editor-field">
              <label>Locality Type</label>
              <select [(ngModel)]="form.localityType" (ngModelChange)="markDirty()">
                <option [ngValue]="null">— Select —</option>
                <option value="URBAN">Urban</option>
                <option value="RURAL">Rural</option>
              </select>
            </div>
          </div>

          <!-- Boolean toggles -->
          <div class="editor-toggles-row">
            <div class="editor-toggle-row">
              <div class="editor-toggle-info">
                <span class="editor-toggle-label">Minority Community</span>
                <span class="editor-toggle-hint">As per National Minority Commission</span>
              </div>
              <button
                class="toggle-btn"
                [class.toggle-btn--on]="form.isMinority"
                (click)="form.isMinority = !form.isMinority; markDirty()"
              >
                {{ form.isMinority ? 'Yes' : 'No' }}
              </button>
            </div>

            <div class="editor-toggle-row">
              <div class="editor-toggle-info">
                <span class="editor-toggle-label">BPL (Below Poverty Line)</span>
                <span class="editor-toggle-hint">Family has a valid BPL card</span>
              </div>
              <button
                class="toggle-btn"
                [class.toggle-btn--on]="form.isBpl"
                (click)="form.isBpl = !form.isBpl; markDirty()"
              >
                {{ form.isBpl ? 'Yes' : 'No' }}
              </button>
            </div>
          </div>
        </div>
        }
      </div>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- SECTION: EP — Enrollment Profile                       -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div class="section-card" [class.section-card--open]="openSections['ep']">
        <button class="udise-section-toggle" (click)="toggleSection('ep')">
          <div class="udise-section-toggle__left">
            <div class="udise-section-badge udise-section-badge--green">EP</div>
            <div>
              <div class="udise-section-toggle__title">Enrollment Profile</div>
              <div class="udise-section-toggle__sub">
                Admission, class, roll number, transfer history
              </div>
            </div>
          </div>
          <div class="udise-section-toggle__right">
            <span
              class="section-score-pill"
              [class.complete]="profile()!.completeness.ep.score === 100"
            >
              EP {{ profile()!.completeness.ep.score }}%
            </span>
            <mat-icon class="udise-chevron" [class.open]="openSections['ep']">expand_more</mat-icon>
          </div>
        </button>

        @if (openSections['ep']) {
        <div class="section-body">
          <div class="form-grid-2">
            <div class="editor-field">
              <label>Admission Number (SR No.) <span class="field-required">*</span></label>
              <input
                [(ngModel)]="form.admissionNumber"
                (ngModelChange)="markDirty()"
                placeholder="School admission / SR number"
              />
            </div>
            <div class="editor-field">
              <label>Date of Admission <span class="field-required">*</span></label>
              <input type="date" [(ngModel)]="form.admissionDate" (ngModelChange)="markDirty()" />
            </div>

            <div class="editor-field">
              <label>Roll Number</label>
              <input
                [(ngModel)]="form.rollNumber"
                (ngModelChange)="markDirty()"
                placeholder="Class roll number"
              />
            </div>

            <div class="editor-field">
              <label>Enrollment Type <span class="field-required">*</span></label>
              <select [(ngModel)]="form.enrollmentType" (ngModelChange)="markDirty()">
                <option value="REGULAR">Regular</option>
                <option value="PRIVATE">Private</option>
                <option value="OPEN_SCHOOL">Open School</option>
              </select>
            </div>

            <div class="editor-field">
              <label>Previous Class Result <span class="field-required">*</span></label>
              <select [(ngModel)]="form.previousClassResult" (ngModelChange)="markDirty()">
                <option [ngValue]="null">— Select —</option>
                <option value="PROMOTED">Promoted</option>
                <option value="NOT_PROMOTED">Not Promoted</option>
                <option value="NEW_ADMISSION">New Admission</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>

            <div class="editor-field col-full">
              <label>Previous School Name</label>
              <input
                [(ngModel)]="form.previousSchool"
                (ngModelChange)="markDirty()"
                placeholder="Name of previous school"
              />
            </div>
          </div>
        </div>
        }
      </div>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- SECTION: SF — Student Facilities                       -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div class="section-card" [class.section-card--open]="openSections['sf']">
        <button class="udise-section-toggle" (click)="toggleSection('sf')">
          <div class="udise-section-toggle__left">
            <div class="udise-section-badge udise-section-badge--orange">SF</div>
            <div>
              <div class="udise-section-toggle__title">Student Facilities</div>
              <div class="udise-section-toggle__sub">
                CWSN, schemes, mid-day meal, textbooks, disability
              </div>
            </div>
          </div>
          <div class="udise-section-toggle__right">
            <span
              class="section-score-pill"
              [class.complete]="profile()!.completeness.sf.score === 100"
            >
              SF {{ profile()!.completeness.sf.score }}%
            </span>
            <mat-icon class="udise-chevron" [class.open]="openSections['sf']">expand_more</mat-icon>
          </div>
        </button>

        @if (openSections['sf']) {
        <div class="section-body">
          <!-- Facilities chip grid -->
          <div class="subsection-header">
            <mat-icon>card_giftcard</mat-icon>
            Government Schemes & Facilities Received
          </div>
          <div class="facilities-grid">
            @for (entry of facilityOptions; track entry.key) {
            <button
              class="facility-chip"
              [class.facility-chip--selected]="isFacilitySelected(entry.key)"
              (click)="toggleFacility(entry.key)"
            >
              <mat-icon class="facility-chip__icon">{{ entry.icon }}</mat-icon>
              {{ entry.label }}
            </button>
            }
          </div>

          <!-- CWSN -->
          <div class="subsection-header" style="margin-top:20px">
            <mat-icon>accessible</mat-icon>
            Children With Special Needs (CWSN)
          </div>

          <div class="editor-toggle-row" style="margin-bottom:14px">
            <div class="editor-toggle-info">
              <span class="editor-toggle-label">CWSN (Student has a disability)</span>
              <span class="editor-toggle-hint">Enable to show disability fields below</span>
            </div>
            <button
              class="toggle-btn"
              [class.toggle-btn--on]="form.isCwsn"
              (click)="form.isCwsn = !form.isCwsn; markDirty()"
            >
              {{ form.isCwsn ? 'Yes — CWSN' : 'No' }}
            </button>
          </div>

          @if (form.isCwsn) {
          <div class="form-grid-2 cwsn-fields">
            <div class="editor-field">
              <label>Disability Type</label>
              <select [(ngModel)]="form.disabilityType" (ngModelChange)="markDirty()">
                <option [ngValue]="null">— Select disability type —</option>
                @for (entry of disabilityOptions; track entry.code) {
                <option [ngValue]="entry.code">{{ entry.code }} — {{ entry.label }}</option>
                }
              </select>
            </div>
            <div class="editor-field">
              <label>UDID Number</label>
              <input
                [(ngModel)]="form.udidNumber"
                (ngModelChange)="markDirty()"
                placeholder="Unique Disability ID"
              />
            </div>
          </div>

          <div class="editor-toggle-row" style="margin-top:8px">
            <div class="editor-toggle-info">
              <span class="editor-toggle-label">Has Disability Certificate</span>
              <span class="editor-toggle-hint">Issued by government medical authority</span>
            </div>
            <button
              class="toggle-btn"
              [class.toggle-btn--on]="form.hasDisabilityCertificate"
              (click)="form.hasDisabilityCertificate = !form.hasDisabilityCertificate; markDirty()"
            >
              {{ form.hasDisabilityCertificate ? 'Yes' : 'No' }}
            </button>
          </div>
          }

          <!-- UDISE Verified master toggle -->
          <div class="subsection-header" style="margin-top:20px">
            <mat-icon>verified_user</mat-icon>
            Verification
          </div>
          <div class="editor-toggle-row">
            <div class="editor-toggle-info">
              <span class="editor-toggle-label">UDISE Profile Verified</span>
              <span class="editor-toggle-hint"
                >Mark after reviewing all sections — required for 100% SF score</span
              >
            </div>
            <button
              class="toggle-btn toggle-btn--large"
              [class.toggle-btn--on]="form.udiseVerified"
              (click)="form.udiseVerified = !form.udiseVerified; markDirty()"
            >
              <mat-icon>{{ form.udiseVerified ? 'verified' : 'pending' }}</mat-icon>
              {{ form.udiseVerified ? 'Verified' : 'Mark as Verified' }}
            </button>
          </div>
        </div>
        }
      </div>

      <!-- Save button (sticky bottom) -->
      <div class="editor-save-bar">
        <button class="editor-cancel-btn" (click)="discardChanges()" [disabled]="!isDirty()">
          Discard
        </button>
        <button class="editor-save-btn" [disabled]="saving() || !isDirty()" (click)="save()">
          @if (saving()) {
          <mat-spinner diameter="16"></mat-spinner>
          Saving… } @else {
          <mat-icon>save</mat-icon>
          Save Changes }
        </button>
      </div>

      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ── Topbar ───────────────────────────────────────────────────── */
      .editor-topbar {
        margin-bottom: 20px;
      }

      .editor-back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
        mat-icon {
          font-size: 18px;
          height: 18px;
          width: 18px;
        }
        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 5%, transparent);
        }
      }

      /* ── Error state ──────────────────────────────────────────────── */
      .editor-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 60px 20px;
        text-align: center;
        color: var(--color-text-muted);

        mat-icon {
          font-size: 40px;
          height: 40px;
          width: 40px;
          opacity: 0.5;
        }
        h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-secondary);
        }
        p {
          margin: 0;
          font-size: 0.875rem;
        }
      }

      .editor-retry-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-primary);
        background: transparent;
        color: var(--color-primary);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
        }
      }

      /* ── Editor header ────────────────────────────────────────────── */
      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 20px 24px;
        margin-bottom: 20px;
        box-shadow: var(--shadow-sm);
        flex-wrap: wrap;
      }

      .editor-header__student {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .editor-avatar {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
        color: var(--color-primary);
        font-size: 1rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .editor-header__info {
        h1 {
          margin: 0 0 6px;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
      }

      .editor-header__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .editor-header__completeness {
        flex-shrink: 0;
      }

      /* ── Unsaved banner ───────────────────────────────────────────── */
      .unsaved-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
        border-radius: var(--radius-sm);
        margin-bottom: 16px;
        font-size: 0.84rem;
        font-weight: 600;
        color: color-mix(in srgb, var(--color-warning) 70%, var(--color-text-primary));

        mat-icon {
          font-size: 18px;
          height: 18px;
          width: 18px;
          color: var(--color-warning);
        }

        span {
          flex: 1;
        }
      }

      .unsaved-banner__actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .unsaved-discard,
      .unsaved-save {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 14px;
        border-radius: var(--radius-sm);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        border: 1px solid;
        transition: all 0.15s ease;
        mat-icon {
          font-size: 14px;
          height: 14px;
          width: 14px;
        }
      }

      .unsaved-discard {
        background: transparent;
        border-color: var(--color-border);
        color: var(--color-text-secondary);
        &:hover {
          background: var(--color-hover);
        }
      }

      .unsaved-save {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
        &:hover:not([disabled]) {
          opacity: 0.88;
        }
        &[disabled] {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      /* ── Section accordion ────────────────────────────────────────── */
      .section-card {
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        margin-bottom: 14px;
        box-shadow: var(--shadow-sm);
        overflow: hidden;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;

        &--open {
          border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
          box-shadow: var(--shadow-md);
        }
      }

      .udise-section-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        gap: 12px;
        transition: background 0.12s ease;

        &:hover {
          background: var(--color-hover);
        }
      }

      .udise-section-toggle__left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .udise-section-toggle__right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .udise-section-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-sm);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        flex-shrink: 0;

        &--blue {
          background: color-mix(in srgb, var(--color-primary) 12%, transparent);
          color: var(--color-primary);
        }
        &--green {
          background: color-mix(in srgb, var(--color-success) 12%, transparent);
          color: var(--color-success);
        }
        &--orange {
          background: color-mix(in srgb, var(--color-warning) 12%, transparent);
          color: color-mix(in srgb, var(--color-warning) 70%, #000);
        }
      }

      .udise-section-toggle__title {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .udise-section-toggle__sub {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        margin-top: 2px;
      }

      .section-score-pill {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 0.7rem;
        font-weight: 700;
        background: color-mix(in srgb, var(--color-warning) 10%, transparent);
        color: color-mix(in srgb, var(--color-warning) 70%, #000);
        border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);

        &.complete {
          background: color-mix(in srgb, var(--color-success) 10%, transparent);
          color: color-mix(in srgb, var(--color-success) 70%, #000);
          border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
        }
      }

      .udise-chevron {
        font-size: 20px;
        height: 20px;
        width: 20px;
        color: var(--color-text-muted);
        transition: transform 0.2s ease;
        &.open {
          transform: rotate(180deg);
        }
      }

      /* ── Section body ─────────────────────────────────────────────── */
      .section-body {
        padding: 20px;
        border-top: 1px solid var(--color-divider);
      }

      /* ── Form fields ──────────────────────────────────────────────── */
      .editor-field {
        display: flex;
        flex-direction: column;
        gap: 5px;

        &.col-full {
          grid-column: 1 / -1;
        }

        label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        input,
        select {
          padding: 9px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-bg-surface);
          color: var(--color-text-primary);
          font-size: 0.875rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease;
          width: 100%;
          box-sizing: border-box;

          &:focus {
            border-color: var(--color-primary);
          }
          &::placeholder {
            color: var(--color-text-muted);
          }
        }
      }

      .field-hint {
        font-size: 0.68rem;
        font-weight: 400;
        color: var(--color-text-muted);
      }

      .field-required {
        color: var(--color-error);
      }

      .field-validation {
        font-size: 0.72rem;
        color: var(--color-error);
        padding: 2px 0;
      }

      /* ── Toggle rows ──────────────────────────────────────────────── */
      .editor-toggles-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
      }

      .editor-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        background: var(--color-hover);
        border: 1px solid var(--color-divider);
        border-radius: var(--radius-sm);
        flex-wrap: wrap;
      }

      .editor-toggle-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .editor-toggle-label {
        font-size: 0.84rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .editor-toggle-hint {
        font-size: 0.72rem;
        color: var(--color-text-muted);
      }

      .toggle-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 7px 14px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-card);
        color: var(--color-text-secondary);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
        flex-shrink: 0;
        mat-icon {
          font-size: 15px;
          height: 15px;
          width: 15px;
        }

        &--on {
          background: color-mix(in srgb, var(--color-success) 10%, transparent);
          border-color: var(--color-success);
          color: color-mix(in srgb, var(--color-success) 70%, #000);
        }

        &--large {
          padding: 9px 18px;
          font-size: 0.84rem;
        }
      }

      /* ── CWSN fields ──────────────────────────────────────────────── */
      .cwsn-fields {
        padding: 14px;
        background: color-mix(in srgb, var(--color-warning) 5%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-warning) 15%, transparent);
        border-radius: var(--radius-sm);
        margin-bottom: 12px;
      }

      /* ── Save bar ─────────────────────────────────────────────────── */
      .editor-save-bar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 20px 0 4px;
        margin-top: 4px;
      }

      .editor-cancel-btn,
      .editor-save-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 22px;
        border-radius: var(--radius-sm);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        border: 1px solid;
        transition: all 0.15s ease;
        mat-icon {
          font-size: 17px;
          height: 17px;
          width: 17px;
        }
      }

      .editor-cancel-btn {
        background: transparent;
        border-color: var(--color-border);
        color: var(--color-text-secondary);
        &:hover:not([disabled]) {
          background: var(--color-hover);
          color: var(--color-text-primary);
        }
        &[disabled] {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      .editor-save-btn {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
        &:hover:not([disabled]) {
          opacity: 0.88;
        }
        &[disabled] {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }
    `,
  ],
})
export class UdiseProfileEditor implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  profile = signal<UDISEStudentProfile | null>(null);
  saving = signal(false);
  isDirty = signal(false);

  studentId = 0;

  /** The mutable form state, seeded from the loaded profile */
  form: UpdateUDISEProfilePayload & {
    fatherName?: string;
    motherName?: string;
    guardianName?: string;
    guardianRelation?: string;
  } = {};

  openSections: Record<SectionKey, boolean> = {
    'gp-identity': true,
    'gp-demographic': false,
    ep: false,
    sf: false,
  };

  // ── Dropdown option lists ────────────────────────────────────────
  readonly socialCategoryOptions = Object.entries(SOCIAL_CATEGORY_LABELS).map(([code, label]) => ({
    code: Number(code),
    label,
  }));
  readonly religionOptions = Object.entries(RELIGION_LABELS).map(([code, label]) => ({
    code: Number(code),
    label,
  }));
  readonly disabilityOptions = Object.entries(DISABILITY_LABELS).map(([code, label]) => ({
    code: Number(code),
    label,
  }));
  readonly motherTongueOptions = Object.entries(MOTHER_TONGUE_LABELS).map(([code, label]) => ({
    code: Number(code),
    label,
  }));
  readonly facilityOptions: { key: FacilityReceived; label: string; icon: string }[] = [
    { key: 'FREE_TEXTBOOKS', label: 'Free Textbooks', icon: 'menu_book' },
    { key: 'FREE_UNIFORM', label: 'Free Uniform', icon: 'checkroom' },
    { key: 'FREE_TRANSPORT', label: 'Free Transport', icon: 'directions_bus' },
    { key: 'FREE_BICYCLE', label: 'Free Bicycle', icon: 'pedal_bike' },
    { key: 'SCHOLARSHIP', label: 'Scholarship', icon: 'school' },
    { key: 'MID_DAY_MEAL', label: 'Mid-Day Meal', icon: 'restaurant' },
    { key: 'FREE_STATIONERY', label: 'Free Stationery', icon: 'edit' },
    { key: 'OTHERS', label: 'Others', icon: 'more_horiz' },
  ];

  initials = computed(() => {
    const name = this.profile()?.name ?? '';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private udiseService: StudentUdiseService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.studentId = parseInt(params.get('id') ?? '0', 10);
      if (this.studentId) this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.udiseService.getProfile(this.studentId).subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.seedForm(res.profile);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to load UDISE profile.');
        this.loading.set(false);
      },
    });
  }

  seedForm(p: UDISEStudentProfile): void {
    this.form = {
      fatherName: p.fatherName ?? '',
      motherName: p.motherName ?? '',
      guardianName: p.guardianName ?? '',
      guardianRelation: p.guardianRelation ?? '',
      pen: p.pen || null,
      apaarId: p.apaarId || null,
      stateStudentId: p.stateStudentId || null,
      aadhaarMasked: p.aadhaarMasked || null,
      aadhaarName: p.aadhaarName || null,
      previousSchoolUdiseCode: p.previousSchoolUdiseCode || null,
      isAadhaarVerified: p.isAadhaarVerified,
      socialCategory: p.socialCategory ?? null,
      religion: p.religion ?? null,
      isMinority: p.isMinority,
      motherTongueCode: p.motherTongueCode ?? null,
      isBpl: p.isBpl,
      localityType: (p.localityType as any) ?? null,
      admissionNumber: p.admissionNumber ?? '',
      admissionDate: this.parseToISODate(p.admissionDate),
      rollNumber: p.rollNumber ?? p.studentRollNumber ?? '',
      enrollmentType: (p.enrollmentType as any) ?? 'REGULAR',
      previousClassResult: (p.previousClassResult as any) ?? null,
      previousSchool: p.previousSchool ?? '',
      isCwsn: p.isCwsn,
      disabilityType: p.disabilityType ?? null,
      hasDisabilityCertificate: p.hasDisabilityCertificate,
      udidNumber: p.udidNumber || null,
      facilitiesReceived: [...p.facilitiesReceived] as FacilityReceived[],
      udiseVerified: p.udiseVerified,
    };
    this.isDirty.set(false);
  }

  markDirty(): void {
    this.isDirty.set(true);
  }

  discardChanges(): void {
    if (this.profile()) this.seedForm(this.profile()!);
    this.isDirty.set(false);
  }

  save(): void {
    this.saving.set(true);

    // Sanitize: convert '' to null for all regex-validated nullable fields
    // so Zod's .nullable().optional() accepts them instead of failing regex.
    const payload: UpdateUDISEProfilePayload = {
      ...this.form,
      pen: this.form.pen || null,
      apaarId: this.form.apaarId || null,
      stateStudentId: this.form.stateStudentId || null,
      aadhaarMasked: this.form.aadhaarMasked || null,
      aadhaarName: this.form.aadhaarName || null,
      previousSchoolUdiseCode: this.form.previousSchoolUdiseCode || null,
      udidNumber: this.form.udidNumber || null,
      admissionDate: this.form.admissionDate || undefined,
    } as UpdateUDISEProfilePayload;

    // ── DEBUG: log exact payload being sent ──────────────────────────
    console.log('[udise] save() raw form:', JSON.parse(JSON.stringify(this.form)));
    console.log('[udise] save() payload to backend:', JSON.parse(JSON.stringify(payload)));

    this.udiseService.updateProfile(this.studentId, payload).subscribe({
      next: () => {
        this.snackBar.open('UDISE profile saved successfully', 'Close', {
          duration: 3500,
          panelClass: 'success-toast',
        });
        this.saving.set(false);
        this.isDirty.set(false);
        this.load(); // Reload to refresh completeness score
      },
      error: (err) => {
        // ── DEBUG: log full error response ───────────────────────────
        console.error('[udise] save() error status:', err?.status);
        console.error('[udise] save() error body:', JSON.stringify(err?.error, null, 2));
        this.snackBar.open(this.extractErrorMessage(err), 'Close', {
          duration: 4000,
          panelClass: 'error-toast',
        });
        this.saving.set(false);
      },
    });
  }

  toggleSection(key: SectionKey): void {
    this.openSections[key] = !this.openSections[key];
  }

  isFacilitySelected(key: FacilityReceived): boolean {
    return (this.form.facilitiesReceived ?? []).includes(key);
  }

  toggleFacility(key: FacilityReceived): void {
    const current = this.form.facilitiesReceived ?? [];
    if (current.includes(key)) {
      this.form.facilitiesReceived = current.filter((f) => f !== key);
    } else {
      this.form.facilitiesReceived = [...current, key];
    }
    this.markDirty();
  }

  goBack(): void {
    this.router.navigate(['/school/students/udise']);
  }

  private extractErrorMessage(err: any): string {
    // err is HttpErrorResponse; err.error is the parsed JSON body

    const body = err?.error;
    if (!body) return 'Failed to save changes';

    // Shape 1 — our backend: { error: "string message" }
    if (typeof body.error === 'string') return body.error;

    // Shape 2 — Hono zValidator: { success: false, error: { issues: [{message: "..."}] } }
    if (body.error?.issues?.length) {
      return body.error.issues.map((i: any) => i.message).join(', ');
    }

    // Shape 3 — Zod flat: { issues: [{message: "..."}] }
    if (body.issues?.length) {
      return body.issues.map((i: any) => i.message).join(', ');
    }

    // Shape 4 — { message: "string" }
    if (typeof body.message === 'string') return body.message;

    return 'Failed to save changes';
  }

  /**
   * Converts a value to a valid YYYY-MM-DD string for <input type="date">,
   * or undefined if the value is absent or unrecognisable.
   *
   * Handles three shapes that can arrive from the DB:
   *   1. Already ISO: "2025-04-15"          → "2025-04-15"
   *   2. Excel serial: "45748" or 45748     → converted via epoch math
   *   3. null / undefined / garbage         → undefined
   */
  private parseToISODate(value: string | null | undefined): string | undefined {
    if (!value) return undefined;

    // Already a valid ISO date YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return value;
    }

    // Excel date serial number (stored as string "45748" or number)
    const serial = Number(value);
    if (!isNaN(serial) && serial > 1000 && serial < 100000) {
      // Excel epoch is 1899-12-30 (accounting for Lotus 1-2-3 leap year bug)
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
      }
    }

    return undefined;
  }
}
