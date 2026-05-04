import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentAdmitCard } from './student-admit-card';

describe('StudentAdmitCard', () => {
  let component: StudentAdmitCard;
  let fixture: ComponentFixture<StudentAdmitCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentAdmitCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentAdmitCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
