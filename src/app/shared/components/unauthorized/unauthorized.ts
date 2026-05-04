import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-unauthorized',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './unauthorized.html',
  styleUrl: './unauthorized.scss',
})
export class Unauthorized {

  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  ngOnInit() {
    this.toast.error('Access denied: Insufficient permissions for this action.');
  }

  goToDashboard() {
    const base = this.auth.schoolCode() ? 'school' : 'super';
    this.router.navigate([`/${base}/dashboard`]);
  }

  logout() {
    this.auth.logout();
  }

}
