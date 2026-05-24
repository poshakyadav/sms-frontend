import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeesDashboard } from './fees-dashboard';

describe('FeesDashboard', () => {
  let component: FeesDashboard;
  let fixture: ComponentFixture<FeesDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeesDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeesDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
