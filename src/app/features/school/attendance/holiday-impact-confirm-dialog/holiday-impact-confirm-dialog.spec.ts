import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HolidayImpactConfirmDialog } from './holiday-impact-confirm-dialog';

describe('HolidayImpactConfirmDialog', () => {
  let component: HolidayImpactConfirmDialog;
  let fixture: ComponentFixture<HolidayImpactConfirmDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HolidayImpactConfirmDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HolidayImpactConfirmDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
