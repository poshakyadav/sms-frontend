import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeStructureForm } from './fee-structure-form';

describe('FeeStructureForm', () => {
  let component: FeeStructureForm;
  let fixture: ComponentFixture<FeeStructureForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeStructureForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeStructureForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
