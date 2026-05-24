// features/login/login.routes.ts
import { Routes } from '@angular/router';

export const LOGIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../login/school-code-entry/school-code-entry').then((m) => m.SchoolCodeEntry),
  },
  {
    path: 'credentials',
    loadComponent: () =>
      import('../school/school-login/school-login-credentials/school-login-credentials').then(
        (m) => m.SchoolLoginCredentials
      ),
  },
];
