import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection, isDevMode,
} from '@angular/core';
import { NavigationError, provideRouter, withNavigationErrorHandler } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { isChunkLoadError, reloadForChunkError } from './core/utils/chunk-reload.util';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // provideRouter(routes),

    provideRouter(
      routes,
      withNavigationErrorHandler((event: NavigationError) => {
        if (isChunkLoadError(event.error)) {
          reloadForChunkError(event.url);
        }
      }),
    ),

    // provideClientHydration(withEventReplay()),

    provideHttpClient(withInterceptors([authInterceptor]), withFetch()),
    provideNativeDateAdapter(), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
};
