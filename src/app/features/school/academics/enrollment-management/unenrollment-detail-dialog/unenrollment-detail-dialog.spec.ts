import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnenrollmentDetailDialog } from './unenrollment-detail-dialog';

describe('UnenrollmentDetailDialog', () => {
  let component: UnenrollmentDetailDialog;
  let fixture: ComponentFixture<UnenrollmentDetailDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnenrollmentDetailDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnenrollmentDetailDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
