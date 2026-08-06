import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
}

// shell with tabs