// app-constants.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central application constants — single source of truth for app-wide metadata.
// To rebrand the app, update values here ONLY.
// Import APP_CONSTANTS wherever you need app-level metadata.
// ─────────────────────────────────────────────────────────────────────────────

export const APP_CONSTANTS = {
    // ── Identity ──────────────────────────────────────────────────────────────
    /** Full display name of the application */
    appName: 'Eduxo',
  
    /** Short tagline shown in hero banners, footers, etc. */
    tagline: 'School Management Platform',
  
    /** Version string (update on each release) */
    version: '1.0.0',
  
    // ── Branding ──────────────────────────────────────────────────────────────
    /** Icon used in the sidebar brand area (Material icon name) */
    brandIcon: 'school',
  
    // ── URLs / Links ──────────────────────────────────────────────────────────
    /** Public-facing website */
    websiteUrl: 'https://eduxo.net',
  
    /** Support / contact email */
    supportEmail: 'support@eduxo.app',
  
    // ── Legal ─────────────────────────────────────────────────────────────────
    /** Company / legal entity name (for Terms, Privacy, etc.) */
    companyName: 'Eduxo Technologies',
  
    /** Year the company was founded (used in copyright notices) */
    foundedYear: 2024,
  
    /** Dynamic copyright year range, e.g. "© 2024–2025 EduFlow Technologies" */
    get copyrightText(): string {
      const current = new Date().getFullYear();
      const year =
        current > this.foundedYear ? `${this.foundedYear}–${current}` : `${this.foundedYear}`;
      return `© ${year} ${this.companyName}`;
    },
  } as const;