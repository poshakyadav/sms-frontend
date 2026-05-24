// features/school/notifications/notifications.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const NOTIFICATIONS_ROUTES: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () =>
      import('./notifications-list/notifications-list').then((m) => m.NotificationsList),
    canActivate: [
      permissionGuard([
        'notifications.view',
        'notifications.student.view',
        'notifications.parent.view',
      ]),
    ],
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./notifications-create/notifications-create').then((m) => m.NotificationsCreate),
    canActivate: [permissionGuard('notifications.send')],
  },
  {
    path: 'report/:id',
    loadComponent: () =>
      import('./notifications-report/notifications-report').then((m) => m.NotificationsReport),
    canActivate: [permissionGuard('notifications.send')],
  },
];
