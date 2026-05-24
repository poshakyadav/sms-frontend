import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkMonthlyStructureForm } from './bulk-monthly-structure-form';

describe('BulkMonthlyStructureForm', () => {
  let component: BulkMonthlyStructureForm;
  let fixture: ComponentFixture<BulkMonthlyStructureForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkMonthlyStructureForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkMonthlyStructureForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
