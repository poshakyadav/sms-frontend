import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignTeacherToClassSectionSubject } from './assign-teacher-to-class-section-subject';

describe('AssignTeacherToClassSectionSubject', () => {
  let component: AssignTeacherToClassSectionSubject;
  let fixture: ComponentFixture<AssignTeacherToClassSectionSubject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignTeacherToClassSectionSubject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignTeacherToClassSectionSubject);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
