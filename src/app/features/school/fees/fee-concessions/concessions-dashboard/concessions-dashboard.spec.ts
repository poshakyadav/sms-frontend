import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConcessionsDashboard } from './concessions-dashboard';

describe('ConcessionsDashboard', () => {
  let component: ConcessionsDashboard;
  let fixture: ComponentFixture<ConcessionsDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConcessionsDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConcessionsDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
