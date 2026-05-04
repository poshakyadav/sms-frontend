import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassSectionForm } from './class-section-form';

describe('ClassSectionForm', () => {
  let component: ClassSectionForm;
  let fixture: ComponentFixture<ClassSectionForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassSectionForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassSectionForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
