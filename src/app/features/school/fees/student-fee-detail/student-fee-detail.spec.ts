import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentFeeDetail } from './student-fee-detail';

describe('StudentFeeDetail', () => {
  let component: StudentFeeDetail;
  let fixture: ComponentFixture<StudentFeeDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentFeeDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentFeeDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
