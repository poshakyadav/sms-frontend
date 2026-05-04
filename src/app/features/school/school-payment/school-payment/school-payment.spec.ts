import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolPayment } from './school-payment';

describe('SchoolPayment', () => {
  let component: SchoolPayment;
  let fixture: ComponentFixture<SchoolPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
