import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubjectsForm } from './subjects-form';

describe('SubjectsForm', () => {
  let component: SubjectsForm;
  let fixture: ComponentFixture<SubjectsForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectsForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubjectsForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
