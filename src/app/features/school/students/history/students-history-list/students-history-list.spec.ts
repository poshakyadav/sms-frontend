import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentsHistoryList } from './students-history-list';

describe('StudentsHistoryList', () => {
  let component: StudentsHistoryList;
  let fixture: ComponentFixture<StudentsHistoryList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentsHistoryList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentsHistoryList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
