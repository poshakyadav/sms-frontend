import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeePaymentDialog } from './fee-payment-dialog';

describe('FeePaymentDialog', () => {
  let component: FeePaymentDialog;
  let fixture: ComponentFixture<FeePaymentDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeePaymentDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeePaymentDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
