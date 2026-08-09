import { Component, effect, inject, signal } from '@angular/core';
import { UpdateService } from '../../../core/services/update.service';

@Component({
  selector: 'app-update-banner',
  imports: [],
  templateUrl: './update-banner.html',
  styleUrl: './update-banner.scss',
})
export class UpdateBanner {
  private updateService = inject(UpdateService);
  updateAvailable = this.updateService.updateAvailable;
  dismissed = signal(false);

  constructor() {
    // lock background scroll while the modal is open
    effect(() => {
      const open = this.updateAvailable() && !this.dismissed();
      document.body.classList.toggle('update-modal-open', open);
    });
  }

  dismiss(): void {
    this.dismissed.set(true);
  }

  refresh(): void {
    this.updateService.activateUpdate();
  }
}