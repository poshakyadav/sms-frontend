import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentHistoryEventCard } from './student-history-event-card';

describe('StudentHistoryEventCard', () => {
  let component: StudentHistoryEventCard;
  let fixture: ComponentFixture<StudentHistoryEventCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentHistoryEventCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentHistoryEventCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
