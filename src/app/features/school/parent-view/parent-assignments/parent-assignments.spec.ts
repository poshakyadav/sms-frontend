import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentAssignments } from './parent-assignments';

describe('ParentAssignments', () => {
  let component: ParentAssignments;
  let fixture: ComponentFixture<ParentAssignments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentAssignments]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentAssignments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
