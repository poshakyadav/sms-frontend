import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UdiseDashboard } from './udise-dashboard';

describe('UdiseDashboard', () => {
  let component: UdiseDashboard;
  let fixture: ComponentFixture<UdiseDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UdiseDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UdiseDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
