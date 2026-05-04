import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeReport } from './fee-report';

describe('FeeReport', () => {
  let component: FeeReport;
  let fixture: ComponentFixture<FeeReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
