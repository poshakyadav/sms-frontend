import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsReport } from './notifications-report';

describe('NotificationsReport', () => {
  let component: NotificationsReport;
  let fixture: ComponentFixture<NotificationsReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
