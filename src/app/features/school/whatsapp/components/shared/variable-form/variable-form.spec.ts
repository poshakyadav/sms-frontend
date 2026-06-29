import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VariableForm } from './variable-form';

describe('VariableForm', () => {
  let component: VariableForm;
  let fixture: ComponentFixture<VariableForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VariableForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VariableForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
