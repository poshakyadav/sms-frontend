import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentResultDialog } from './payment-result-dialog';

describe('PaymentResultDialog', () => {
  let component: PaymentResultDialog;
  let fixture: ComponentFixture<PaymentResultDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentResultDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentResultDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
