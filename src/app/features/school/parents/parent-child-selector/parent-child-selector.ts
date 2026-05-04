// parent-child-selector.component.ts
// Shown after login when user is a STUDENT_PARENT with multiple children

import {
  Component,
  inject,
  signal,
  computed,
  Output,
  EventEmitter,
  Input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParentService, ParentChild } from '../../../../core/services/parent.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-parent-child-selector',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-child-selector.html',
  styleUrl: './parent-child-selector.scss',
})
export class ParentChildSelectorComponent {
  @Input({ required: true }) children: ParentChild[] = [];
  @Output() childSelected = new EventEmitter<ParentChild>();

  private parentService = inject(ParentService);
  private router = inject(Router);

  hoveredId = signal<number | null>(null);

  childrenSignal = computed(() => this.children);

  selectChild(child: ParentChild): void {
    this.parentService.setActiveChild(child.studentId);
    this.childSelected.emit(child);
  }

  onBackdropClick(event: MouseEvent): void {
    // Don't close on backdrop click — parent MUST select a child
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
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  }
}
