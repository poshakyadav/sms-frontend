// features/school/feed/feed.routes.ts

import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const FEED_ROUTES: Routes = [
  // ── Consumption view — every authenticated school user (students, parents,
  // staff) can view the feed. No permissionGuard here: the backend already
  // filters content by role/audience server-side (see canViewFeed() in
  // routes.ts and buildFeedVisibilityClause() in services.ts), so a frontend
  // guard would only duplicate that logic and risk drifting out of sync.
  {
    path: '',
    loadComponent: () => import('./feed-page/feed-page').then((m) => m.FeedPage),
  },

  // ── Admin management view — SCHOOL_OWNER / feed.post.create / feed.post.manage
  {
    path: 'manage',
    loadComponent: () => import('./feed-admin-page/feed-admin-page').then((m) => m.FeedAdminPage),
    canActivate: [permissionGuard(['feed.post.create', 'feed.post.manage'])],
  },
];
