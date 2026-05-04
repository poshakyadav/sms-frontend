import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentsHistory } from './payments-history';

describe('PaymentsHistory', () => {
  let component: PaymentsHistory;
  let fixture: ComponentFixture<PaymentsHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentsHistory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentsHistory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
