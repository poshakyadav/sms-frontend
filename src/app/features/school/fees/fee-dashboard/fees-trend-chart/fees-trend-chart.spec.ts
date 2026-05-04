import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeesTrendChart } from './fees-trend-chart';

describe('FeesTrendChart', () => {
  let component: FeesTrendChart;
  let fixture: ComponentFixture<FeesTrendChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeesTrendChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeesTrendChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
