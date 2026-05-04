import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecordPayment } from './record-payment';

describe('RecordPayment', () => {
  let component: RecordPayment;
  let fixture: ComponentFixture<RecordPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecordPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecordPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
