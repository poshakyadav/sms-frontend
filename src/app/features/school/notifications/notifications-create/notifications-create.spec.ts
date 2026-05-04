import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsCreate } from './notifications-create';

describe('NotificationsCreate', () => {
  let component: NotificationsCreate;
  let fixture: ComponentFixture<NotificationsCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
