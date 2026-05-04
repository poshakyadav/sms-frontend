import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class ToastService {

  // Base config defaults (production-grade: consistent, customizable)
  private defaultConfig: MatSnackBarConfig = {
    duration: 5000,
    horizontalPosition: 'end',
    verticalPosition: 'top',
    panelClass: [],
  };

  constructor(private snackBar: MatSnackBar) {}

  // Generic show (with optional action and override config)
  show(
    message: string,
    action: string = 'Close',
    config: Partial<MatSnackBarConfig> = {}
  ): void {
    const fullConfig: MatSnackBarConfig = { ...this.defaultConfig, ...config };
    this.snackBar.open(message, action, fullConfig);
  }

  // Error toast (red, longer duration for visibility)
  error(message: string, action: string = 'Close'): void {
    this.show(message, action, { 
      duration: 8000, 
      panelClass: ['error-toast'] 
    });
  }

  // Success toast (green, standard duration)
  success(message: string, action: string = 'Close'): void {
    this.show(message, action, { 
      panelClass: ['success-toast'] 
    });
  }

  // ← NEW: Info toast (blue/neutral, shorter for non-critical info)
  info(message: string, action: string = 'Close'): void {
    this.show(message, action, { 
      duration: 4000, 
      panelClass: ['info-toast'] 
    });
  }

  // ← NEW: Warning toast (orange, medium duration for cautions)
  warning(message: string, action: string = 'Close'): void {
    this.show(message, action, { 
      duration: 6000, 
      panelClass: ['warning-toast'] 
    });
  }
  
}
