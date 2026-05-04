import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentExams } from './student-exams';

describe('StudentExams', () => {
  let component: StudentExams;
  let fixture: ComponentFixture<StudentExams>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentExams]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentExams);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
