import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnrollmentManagement } from './enrollment-management';

describe('EnrollmentManagement', () => {
  let component: EnrollmentManagement;
  let fixture: ComponentFixture<EnrollmentManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnrollmentManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EnrollmentManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
