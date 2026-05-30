import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentHistoryStatsCard } from './student-history-stats-card';

describe('StudentHistoryStatsCard', () => {
  let component: StudentHistoryStatsCard;
  let fixture: ComponentFixture<StudentHistoryStatsCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentHistoryStatsCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentHistoryStatsCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
