import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleDetailDialog } from './role-detail-dialog';

describe('RoleDetailDialog', () => {
  let component: RoleDetailDialog;
  let fixture: ComponentFixture<RoleDetailDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleDetailDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoleDetailDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
