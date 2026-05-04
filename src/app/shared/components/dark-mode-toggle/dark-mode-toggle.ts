import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-dark-mode-toggle',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './dark-mode-toggle.html',
  styleUrl: './dark-mode-toggle.scss',
})
export class DarkModeToggle {
  private themeService = inject(ThemeService);

  // Reactive signal for current dark mode state
  isDarkMode = signal<boolean>(false);

  constructor() {
    // Initialize from current DOM state
    this.updateDarkModeState();

    // Listen to changes and keep signal in sync
    effect(() => {
      this.updateDarkModeState();
    });
  }

  private updateDarkModeState(): void {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    this.isDarkMode.set(isDark);
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
    // Signal will update automatically via effect
  }
}
