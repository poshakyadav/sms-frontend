import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeReceiptDialog } from './fee-receipt-dialog';

describe('FeeReceiptDialog', () => {
  let component: FeeReceiptDialog;
  let fixture: ComponentFixture<FeeReceiptDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeReceiptDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeReceiptDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
