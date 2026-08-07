import { Component, computed, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../../../core/services/auth.service';
import { ManageCalendarComponent } from '../manage-calendar-component/manage-calendar-component';
import { MissingAttendanceComponent } from '../missing-attendance-component/missing-attendance-component';
import { AttendanceSettingsComponent } from '../attendance-settings-component/attendance-settings-component';

@Component({
  selector: 'app-attendance-calendar',
  standalone: true,
  imports: [MatTabsModule, ManageCalendarComponent, MissingAttendanceComponent, AttendanceSettingsComponent],
  templateUrl: './attendance-calendar-component.html',
  styleUrl: './attendance-calendar-component.scss',
})
export class AttendanceCalendarComponent {
  private auth = inject(AuthService);
  canManage = computed(() => this.auth.hasPermission('attendance.calendar.manage'));

  // Read ONCE, as a plain value — not a signal, not bound reactively.
  // mat-tab-group + <ng-template matTabContent> has a confirmed upstream bug
  // (angular/components#31703) when selectedIndex is *continuously* driven
  // by a changing expression: the lazily-created tab view ends up being
  // instantiated mid change-detection-cycle — exactly the NG0100 error and
  // the MatFormFieldControl assertion you're seeing. Fix: set it once, then
  // never write back into it. mat-tab-group fully owns selection after that.
  readonly initialTabIndex = this.canManage() ? 0 : 1;
}