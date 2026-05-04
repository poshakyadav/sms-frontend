// src/app/features/school/parent/parent-child-switcher/parent-child-switcher.component.ts
// Navbar dropdown for switching between children — shown ONLY for STUDENT_PARENT role

import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParentService } from '../../../../core/services/parent.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-parent-child-switcher',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-child-switcher.html',
  styleUrl: './parent-child-switcher.scss',
})
export class ParentChildSwitcherComponent {
  private parentService = inject(ParentService);
  private auth = inject(AuthService);

  isOpen = signal(false);

  // All signals from ParentService
  children = this.parentService.children;
  activeChild = this.parentService.activeChild;
  activeChildId = this.parentService.activeChildId;
  hasChildren = this.parentService.hasChildren;

  // Only show for STUDENT_PARENT role
  isParent = computed(() => this.auth.userRole() === 'STUDENT_PARENT');

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Close if click is outside this component
    if (!target.closest('app-parent-child-switcher')) {
      this.isOpen.set(false);
    }
  }

  toggleDropdown(): void {
    this.isOpen.update((v) => !v);
  }

  switchTo(child: { studentId: number; studentName: string }): void {
    this.parentService.switchChild(child.studentId);
    this.isOpen.set(false);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#3b82f6',
      '#ef4444',
      '#14b8a6',
    ];
    let hash = 0;
    for (const ch of name) hash += ch.charCodeAt(0);
    return colors[hash % colors.length];
  }
}
