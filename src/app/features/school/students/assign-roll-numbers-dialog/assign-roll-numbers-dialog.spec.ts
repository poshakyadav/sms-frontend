import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignRollNumbersDialog } from './assign-roll-numbers-dialog';

describe('AssignRollNumbersDialog', () => {
  let component: AssignRollNumbersDialog;
  let fixture: ComponentFixture<AssignRollNumbersDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignRollNumbersDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignRollNumbersDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
