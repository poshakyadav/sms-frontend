import { Component, effect, inject } from '@angular/core';
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

  constructor() {
    // lock background scroll while the modal is open
    effect(() => {
      document.body.classList.toggle('update-modal-open', this.updateAvailable());
    });
  }

  refresh(): void {
    this.updateService.activateUpdate();
  }
}