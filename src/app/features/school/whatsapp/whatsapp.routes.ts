// src/app/features/school/whatsapp/whatsapp.routes.ts

import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const WHATSAPP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/whatsapp-overview/whatsapp-overview').then((m) => m.WhatsappOverview),
    canActivate: [permissionGuard('billing.view')],
  },
  {
    path: 'send',
    loadComponent: () =>
      import('./components/whatsapp-send/whatsapp-send').then((m) => m.WhatsappSend),
    canActivate: [permissionGuard('billing.manage')],
  },
  {
    path: 'bulk',
    loadComponent: () =>
      import('./components/whatsapp-bulk/whatsapp-bulk').then((m) => m.WhatsappBulk),
    canActivate: [permissionGuard('billing.manage')],
  },
  {
    path: 'bulk/:id',
    loadComponent: () =>
      import('./components/whatsapp-bulk-detail/whatsapp-bulk-detail').then(
        (m) => m.WhatsappBulkDetail
      ),
    canActivate: [permissionGuard('billing.view')],
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./components/whatsapp-history/whatsapp-history').then((m) => m.WhatsappHistory),
    canActivate: [permissionGuard('billing.view')],
  },
  {
    path: 'inbound',
    loadComponent: () =>
      import('./components/whatsapp-inbound/whatsapp-inbound').then((m) => m.WhatsappInbound),
    canActivate: [permissionGuard('billing.view')],
  },
];
