// features/school/users/users.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../../core/guards/permission-guard';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./users-list/users-list').then((m) => m.UsersList),
    canActivate: [permissionGuard('users.list')],
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./user-creation-hub/user-creation-hub').then((m) => m.UserCreationHub),
    canActivate: [permissionGuard('users.create')],
  },
  {
    path: 'bulk-photo-upload',
    loadComponent: () =>
      import('./bulk-photo-upload/bulk-photo-upload').then((m) => m.BulkPhotoUpload),
    canActivate: [permissionGuard(['users.create', 'users.edit'])],
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./user-form/user-form').then((m) => m.UserForm),
    canActivate: [permissionGuard('users.edit')],
  },
];
