import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeItemPaymentHistoryDialog } from './fee-item-payment-history-dialog';

describe('FeeItemPaymentHistoryDialog', () => {
  let component: FeeItemPaymentHistoryDialog;
  let fixture: ComponentFixture<FeeItemPaymentHistoryDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeItemPaymentHistoryDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeItemPaymentHistoryDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
