import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeLedger } from './fee-ledger';

describe('FeeLedger', () => {
  let component: FeeLedger;
  let fixture: ComponentFixture<FeeLedger>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeLedger]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeLedger);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
