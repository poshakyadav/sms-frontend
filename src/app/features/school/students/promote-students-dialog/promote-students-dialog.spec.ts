import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromoteStudentsDialog } from './promote-students-dialog';

describe('PromoteStudentsDialog', () => {
  let component: PromoteStudentsDialog;
  let fixture: ComponentFixture<PromoteStudentsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoteStudentsDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromoteStudentsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
