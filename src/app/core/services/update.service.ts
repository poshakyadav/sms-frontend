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
        console.log(`[UpdateService] New version ready: ${ready.latestVersion.hash}`);
        this._updateAvailable.set(true);
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

  /** Bound to the banner's "Refresh" button. */
  activateUpdate(): void {
    location.reload();
  }
}