import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttendanceStatusDocs } from './attendance-status-docs';

describe('AttendanceStatusDocs', () => {
  let component: AttendanceStatusDocs;
  let fixture: ComponentFixture<AttendanceStatusDocs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceStatusDocs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttendanceStatusDocs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
