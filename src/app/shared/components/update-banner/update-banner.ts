import { Component, inject } from '@angular/core';
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

  refresh(): void {
    this.updateService.activateUpdate();
  }
}