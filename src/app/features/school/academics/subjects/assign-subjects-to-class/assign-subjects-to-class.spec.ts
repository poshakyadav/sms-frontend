import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignSubjectsToClass } from './assign-subjects-to-class';

describe('AssignSubjectsToClass', () => {
  let component: AssignSubjectsToClass;
  let fixture: ComponentFixture<AssignSubjectsToClass>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignSubjectsToClass]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignSubjectsToClass);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
