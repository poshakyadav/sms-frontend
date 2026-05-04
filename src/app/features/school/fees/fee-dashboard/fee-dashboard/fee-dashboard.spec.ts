import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeDashboard } from './fee-dashboard';

describe('FeeDashboard', () => {
  let component: FeeDashboard;
  let fixture: ComponentFixture<FeeDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
