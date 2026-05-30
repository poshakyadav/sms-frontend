import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentsHistoryDetail } from './students-history-detail';

describe('StudentsHistoryDetail', () => {
  let component: StudentsHistoryDetail;
  let fixture: ComponentFixture<StudentsHistoryDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentsHistoryDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentsHistoryDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
