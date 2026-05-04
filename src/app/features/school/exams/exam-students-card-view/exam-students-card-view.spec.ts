import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamStudentsCardView } from './exam-students-card-view';

describe('ExamStudentsCardView', () => {
  let component: ExamStudentsCardView;
  let fixture: ComponentFixture<ExamStudentsCardView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamStudentsCardView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamStudentsCardView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
