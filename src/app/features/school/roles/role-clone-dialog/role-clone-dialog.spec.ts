import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleCloneDialog } from './role-clone-dialog';

describe('RoleCloneDialog', () => {
  let component: RoleCloneDialog;
  let fixture: ComponentFixture<RoleCloneDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleCloneDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoleCloneDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
