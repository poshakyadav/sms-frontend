import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditBalanceChip } from './credit-balance-chip';

describe('CreditBalanceChip', () => {
  let component: CreditBalanceChip;
  let fixture: ComponentFixture<CreditBalanceChip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditBalanceChip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreditBalanceChip);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
