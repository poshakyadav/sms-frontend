import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamsList } from './exams-list';

describe('ExamsList', () => {
  let component: ExamsList;
  let fixture: ComponentFixture<ExamsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
