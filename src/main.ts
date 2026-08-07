import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { isChunkLoadError, reloadForChunkError } from './app/core/utils/chunk-reload.util';

// ===
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    reloadForChunkError(location.pathname + location.search);
  }
});
// ===

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
