// shared/components/auth-footer/auth-footer.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-auth-footer',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './auth-footer.html',
  styleUrl: './auth-footer.scss',
})
export class AuthFooter {
  readonly year = new Date().getFullYear();
}
