import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentConfig } from './payment-config';

describe('PaymentConfig', () => {
  let component: PaymentConfig;
  let fixture: ComponentFixture<PaymentConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentConfig]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentConfig);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
