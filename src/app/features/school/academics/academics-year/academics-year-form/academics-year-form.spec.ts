import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcademicsYearForm } from './academics-year-form';

describe('AcademicsYearForm', () => {
  let component: AcademicsYearForm;
  let fixture: ComponentFixture<AcademicsYearForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcademicsYearForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcademicsYearForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
