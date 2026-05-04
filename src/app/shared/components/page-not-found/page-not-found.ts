import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-page-not-found',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './page-not-found.html',
  styleUrl: './page-not-found.scss',
})
export class PageNotFound {

  private auth = inject(AuthService);
  constructor(private router: Router) {}

  goHome() {
    if (this.auth.isAuthenticated()) {
      const base = this.auth.schoolCode() ? 'school' : 'super';
      this.router.navigate([`/${base}/dashboard`]);
    } else {
      this.router.navigate(['/login']);
    }
  }

}
