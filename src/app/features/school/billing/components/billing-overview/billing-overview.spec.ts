import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BillingOverview } from './billing-overview';

describe('BillingOverview', () => {
  let component: BillingOverview;
  let fixture: ComponentFixture<BillingOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BillingOverview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
