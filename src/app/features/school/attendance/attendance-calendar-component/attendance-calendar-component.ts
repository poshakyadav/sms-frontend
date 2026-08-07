// attendance-calendar-component.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../../../core/services/auth.service';
import { ManageCalendarComponent } from '../manage-calendar-component/manage-calendar-component';
import { MissingAttendanceComponent } from '../missing-attendance-component/missing-attendance-component';
import { AttendanceSettingsComponent } from '../attendance-settings-component/attendance-settings-component';

type CalendarTabId = 'manage' | 'missing' | 'settings';

@Component({
  selector: 'app-attendance-calendar',
  standalone: true,
  imports: [CommonModule, MatTabsModule, ManageCalendarComponent, MissingAttendanceComponent, AttendanceSettingsComponent],
  templateUrl: './attendance-calendar-component.html',
  styleUrl: './attendance-calendar-component.scss',
})
export class AttendanceCalendarComponent {
  private auth = inject(AuthService);
  canManage = computed(() => this.auth.hasPermission('attendance.calendar.manage'));

  // Order here must match the @if blocks in the template below.
  private tabIds = computed<CalendarTabId[]>(() => {
    const ids: CalendarTabId[] = [];
    if (this.canManage()) ids.push('manage');
    ids.push('missing');
    if (this.canManage()) ids.push('settings');
    return ids;
  });

  // Selection lives on a stable id — never a raw index — so it can't
  // desync when canManage() flips and the tab list shifts.
  private selectedId = signal<CalendarTabId>('manage');

  selectedIndex = computed(() => {
    const idx = this.tabIds().indexOf(this.selectedId());
    return idx === -1 ? 0 : idx;
  });

  onIndexChange(index: number) {
    const id = this.tabIds()[index];
    if (id) this.selectedId.set(id);
  }
}