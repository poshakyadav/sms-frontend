import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentAttendanceComponent } from './parent-attendance-component';

describe('ParentAttendanceComponent', () => {
  let component: ParentAttendanceComponent;
  let fixture: ComponentFixture<ParentAttendanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentAttendanceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentAttendanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
