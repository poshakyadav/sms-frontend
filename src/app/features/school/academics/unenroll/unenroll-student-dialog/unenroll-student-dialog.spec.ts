import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnenrollStudentDialog } from './unenroll-student-dialog';

describe('UnenrollStudentDialog', () => {
  let component: UnenrollStudentDialog;
  let fixture: ComponentFixture<UnenrollStudentDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnenrollStudentDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnenrollStudentDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
