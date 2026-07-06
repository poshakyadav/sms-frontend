import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeReceiptView } from './fee-receipt-view';

describe('FeeReceiptView', () => {
  let component: FeeReceiptView;
  let fixture: ComponentFixture<FeeReceiptView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeReceiptView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeReceiptView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
