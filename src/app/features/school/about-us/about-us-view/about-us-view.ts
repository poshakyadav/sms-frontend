// src/app/features/school/about-us/about-us-view/about-us-view.ts
// ─────────────────────────────────────────────────────────────────────────────
// School About Us — READ-ONLY VIEW
// Route:      /school/about-us
// Guard:      schoolAuthGuard (all authenticated school users)
// Permission: none — every role can view
// ─────────────────────────────────────────────────────────────────────────────

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AboutUsService, AboutUsData } from '../../../../core/services/about-us.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-about-us-view',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
  ],
  templateUrl: './about-us-view.html',
  styleUrl: './about-us-view.scss',
})
export class AboutUsView implements OnInit {
  private aboutUsService = inject(AboutUsService);
  protected auth = inject(AuthService);

  // ── State ─────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<AboutUsData | null>(null);

  // Gallery state
  activeGalleryIndex = signal(0);

  // ── Computed ──────────────────────────────────────────────────────────────
  /** Only settings.manage users see the Edit button */
  canEdit = computed(() => this.auth.hasPermission('settings.manage'));

  hasStats = computed(() => {
    const d = this.data();
    return !!(
      d &&
      (d.totalStudents !== null ||
        d.totalTeachers !== null ||
        d.totalStaff !== null ||
        d.campusAreaAcres ||
        d.foundedYear)
    );
  });

  hasSocial = computed(() => {
    const d = this.data();
    return !!(
      d &&
      (d.facebookUrl || d.twitterUrl || d.instagramUrl || d.youtubeUrl || d.linkedinUrl)
    );
  });

  /** True when there is meaningful content to display */
  hasContent = computed(() => {
    const d = this.data();
    if (!d) return false;
    return !!(
      d.description ||
      d.mission ||
      d.vision ||
      d.history ||
      d.principalName ||
      d.affiliationBoard ||
      d.accreditation ||
      d.facilities?.length ||
      d.coreValues?.length ||
      d.achievements?.length ||
      d.galleryUrls?.length
    );
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.aboutUsService.getAboutUs().subscribe({
      next: (res) => {
        this.data.set(res.aboutUs);
        this.activeGalleryIndex.set(0);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load About Us. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // ── Gallery controls ──────────────────────────────────────────────────────
  setGalleryIndex(i: number): void {
    this.activeGalleryIndex.set(i);
  }

  prevGallery(): void {
    const len = this.data()?.galleryUrls?.length ?? 0;
    if (!len) return;
    this.activeGalleryIndex.set((this.activeGalleryIndex() - 1 + len) % len);
  }

  nextGallery(): void {
    const len = this.data()?.galleryUrls?.length ?? 0;
    if (!len) return;
    this.activeGalleryIndex.set((this.activeGalleryIndex() + 1) % len);
  }

  /** Called by (error) event on <img> — hides broken image */
  onImgError(event: Event): void {
    const el = event.target as HTMLImageElement;
    if (el) el.style.display = 'none';
  }

  // ── Social links ──────────────────────────────────────────────────────────
  openSocial(url: string): void {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ── Stat display ──────────────────────────────────────────────────────────
  formatStat(val: number | null): string {
    if (val === null || val === undefined) return '—';
    if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k+';
    return val.toString() + '+';
  }
}
