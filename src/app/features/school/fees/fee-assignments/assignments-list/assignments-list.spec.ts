import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignmentsList } from './assignments-list';

describe('AssignmentsList', () => {
  let component: AssignmentsList;
  let fixture: ComponentFixture<AssignmentsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignmentsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignmentsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
