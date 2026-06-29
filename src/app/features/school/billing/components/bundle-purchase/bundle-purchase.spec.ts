import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BundlePurchase } from './bundle-purchase';

describe('BundlePurchase', () => {
  let component: BundlePurchase;
  let fixture: ComponentFixture<BundlePurchase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BundlePurchase]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BundlePurchase);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
