// src/app/features/public/id-card-verify/id-card-verify.component.ts
//
// PUBLIC route — added to PUBLIC_ROUTES, no auth guard. This is what opens
// when someone scans a printed card's QR code. Calls the backend's public
// /verify/:token?school=... endpoint directly via HttpClient (NOT through
// ApiService, since ApiService's base path assumes the authenticated school
// API surface — this hits the unauthenticated /verify route registered at
// the app root in src/index.ts, separate from /school/*).

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface VerifyResponse {
  valid: boolean;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'REISSUED' | 'NOT_FOUND';
  holderName?: string;
  holderType?: 'STUDENT' | 'STAFF';
  photoUrl?: string | null;
  roleLabel?: string;
  validUntil?: string;
  cardNumber?: string;
}

@Component({
  selector: 'app-id-card-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './id-card-verify.component.html',
  styleUrl: './id-card-verify.component.scss',
})
export class IdCardVerifyComponent implements OnInit {
  loading = true;
  result: VerifyResponse | null = null;
  errorMessage: string | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    const schoolCode = this.route.snapshot.queryParamMap.get('school');

    if (!token || !schoolCode) {
      this.loading = false;
      this.errorMessage = 'This verification link is missing required information.';
      return;
    }

    this.http
      .get<VerifyResponse>(`${environment.apiUrl}/verify/${token}`, {
        params: { school: schoolCode },
      })
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Could not verify this card right now. Please try again shortly.';
          this.loading = false;
        },
      });
  }

  get statusLabel(): string {
    switch (this.result?.status) {
      case 'ACTIVE':
        return 'Valid ID Card';
      case 'EXPIRED':
        return 'Card Expired';
      case 'REVOKED':
        return 'Card Revoked';
      case 'REISSUED':
        return 'Card Superseded';
      default:
        return 'Card Not Found';
    }
  }
}
