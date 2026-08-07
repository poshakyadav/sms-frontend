// app.ts

import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { consumePendingChunkRedirect } from './core/utils/chunk-reload.util';
import { UpdateBanner } from './shared/components/update-banner/update-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateBanner],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Eduxo');

  // ===
  private router = inject(Router);

  ngOnInit(): void {
    const redirect = consumePendingChunkRedirect();
    if (redirect) {
      this.router.navigateByUrl(redirect);
    }
  }
}
