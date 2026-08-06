import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarActionDialog } from './calendar-action-dialog';

describe('CalendarActionDialog', () => {
  let component: CalendarActionDialog;
  let fixture: ComponentFixture<CalendarActionDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarActionDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarActionDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
