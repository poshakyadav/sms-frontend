import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../../../core/services/auth.service';
import { ManageCalendarComponent } from '../manage-calendar-component/manage-calendar-component';
import { MissingAttendanceComponent } from '../missing-attendance-component/missing-attendance-component';
import { AttendanceSettingsComponent } from '../attendance-settings-component/attendance-settings-component';

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

  // Owns the tab index ourselves so it can't end up pointing at a tab
  // that no longer exists at that position when canManage() flips
  // (e.g. permissions finish loading after first render).
  selectedIndex = signal(0);

  constructor() {
    effect(() => {
      this.canManage(); // track it
      this.selectedIndex.set(0); // snap back whenever the tab list changes
    });
  }
}

// shell with tabs