import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolPaymentStatus } from './school-payment-status';

describe('SchoolPaymentStatus', () => {
  let component: SchoolPaymentStatus;
  let fixture: ComponentFixture<SchoolPaymentStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolPaymentStatus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolPaymentStatus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
