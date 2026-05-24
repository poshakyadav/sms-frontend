import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkAssignmentForm } from './bulk-assignment-form';

describe('BulkAssignmentForm', () => {
  let component: BulkAssignmentForm;
  let fixture: ComponentFixture<BulkAssignmentForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkAssignmentForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkAssignmentForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
