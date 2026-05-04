import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentStudentLink } from './parent-student-link';

describe('ParentStudentLink', () => {
  let component: ParentStudentLink;
  let fixture: ComponentFixture<ParentStudentLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentStudentLink]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentStudentLink);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
