import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleFormDialog } from './role-form-dialog';

describe('RoleFormDialog', () => {
  let component: RoleFormDialog;
  let fixture: ComponentFixture<RoleFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleFormDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoleFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
