import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentExams } from './parent-exams';

describe('ParentExams', () => {
  let component: ParentExams;
  let fixture: ComponentFixture<ParentExams>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentExams]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentExams);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
