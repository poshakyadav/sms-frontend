import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamsForm } from './exams-form';

describe('ExamsForm', () => {
  let component: ExamsForm;
  let fixture: ComponentFixture<ExamsForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamsForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamsForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
