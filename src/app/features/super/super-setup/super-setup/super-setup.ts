// src/app/features/super/super-setup/super-setup.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

@Component({
  selector: 'app-super-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './super-setup.html',
  styleUrl: './super-setup.scss',
})
export class SuperSetup implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // ── Form state ──────────────────────────────────────────────────────────────
  name = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  showConfirm = signal(false);
  loading = signal(false);
  error = signal('');
  step = signal<'form' | 'success'>('form');

  // ── Validation ──────────────────────────────────────────────────────────────
  passwordStrength = computed<PasswordStrength>(() => {
    const p = this.password();
    if (!p) return { score: 0, label: '', color: '' };

    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    const map: PasswordStrength[] = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: '#ef4444' },
      { score: 2, label: 'Fair', color: '#f97316' },
      { score: 3, label: 'Good', color: '#eab308' },
      { score: 4, label: 'Strong', color: '#22c55e' },
      { score: 5, label: 'Very Strong', color: '#16a34a' },
    ];
    return map[score] ?? map[4];
  });

  passwordsMatch = computed(
    () => this.confirmPassword() === '' || this.password() === this.confirmPassword()
  );

  formValid = computed(
    () =>
      this.name().trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email()) &&
      this.password().length >= 8 &&
      /[A-Z]/.test(this.password()) &&
      /[0-9]/.test(this.password()) &&
      /[^A-Za-z0-9]/.test(this.password()) &&
      this.password() === this.confirmPassword()
  );

  // ── Requirements list for UX ─────────────────────────────────────────────
  passwordRequirements = computed(() => {
    const p = this.password();
    return [
      { text: 'At least 8 characters', met: p.length >= 8 },
      { text: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(p) },
      { text: 'One number (0-9)', met: /[0-9]/.test(p) },
      { text: 'One special character (!@#…)', met: /[^A-Za-z0-9]/.test(p) },
    ];
  });

  ngOnInit(): void {
    // Guard already verified setupRequired, but double-check
    // so a stale guard pass doesn't leak through
    this.auth.checkSetupRequired().subscribe({
      next: (res) => {
        if (!res.setupRequired) {
          this.router.navigate(['/super/login']);
        }
      },
      error: () => this.router.navigate(['/super/login']),
    });
  }

  submit(): void {
    if (this.loading() || !this.formValid()) return;

    this.error.set('');
    this.loading.set(true);

    this.auth
      .setupSuperAdmin({
        name: this.name().trim(),
        email: this.email().trim().toLowerCase(),
        password: this.password(),
        confirmPassword: this.confirmPassword(),
      })
      .subscribe({
        next: () => {
          this.step.set('success');
          this.loading.set(false);
        },
        error: (err: any) => {
          const msg = err?.error?.error || err?.message || 'Setup failed. Please try again.';
          this.error.set(msg);
          this.loading.set(false);
        },
      });
  }

  goToDashboard(): void {
    this.router.navigate(['/super/dashboard']);
  }
}
