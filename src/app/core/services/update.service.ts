import { ApplicationRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, first, interval } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  private readonly _updateAvailable = signal(false);
  readonly updateAvailable = this._updateAvailable.asReadonly();

  constructor() {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') {
        const ready = evt as VersionReadyEvent;
        console.log(`[UpdateService] New version ready: ${ready.latestVersion.hash} — activating in background`);

        // Activate right away, in the background. This swaps which SW is
        // "active" so the next document/asset request is served the new
        // version — it does NOT reload the current page. Doing this here
        // (instead of waiting for the button click) means that even if the
        // user manually refreshes before clicking anything, the SW is
        // already fully switched over and internally consistent.
        this.swUpdate
          .activateUpdate()
          .then(() => {
            console.log(`[UpdateService] New version ${ready.latestVersion.hash} activated — prompting reload`);
            this._updateAvailable.set(true);
          })
          .catch((err) => console.error('[UpdateService] activateUpdate failed:', err));
      }
      if (evt.type === 'VERSION_INSTALLATION_FAILED') {
        console.error(`[UpdateService] Install failed for ${evt.version.hash}: ${evt.error}`);
      }
    });

    // SW is in a broken state that can't be fixed without a reload — just reload.
    this.swUpdate.unrecoverable.subscribe((event) => {
      console.error('[UpdateService] Unrecoverable state:', event.reason);
      location.reload();
    });

    // Periodic check for tabs left open all day (a school owner's dashboard).
    // Wait for app stability first so this never delays first paint.
    const appIsStable$ = this.appRef.isStable.pipe(first((stable) => stable));
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    concat(appIsStable$, everySixHours$).subscribe(() => {
      this.swUpdate.checkForUpdate().catch((err) => console.error('[UpdateService] checkForUpdate failed:', err));
    });
  }

  /**
   * Bound to the popup's "Reload now" button. By the time this is called,
   * the new SW version has already been activated in the background (see
   * VERSION_READY above) — this just performs the actual page reload so
   * the tab picks up the already-active version.
   */
  activateUpdate(): void {
    location.reload();
  }
}