import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentReportCard } from './parent-report-card';

describe('ParentReportCard', () => {
  let component: ParentReportCard;
  let fixture: ComponentFixture<ParentReportCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentReportCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentReportCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
