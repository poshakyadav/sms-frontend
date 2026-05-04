import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionSync } from './permission-sync';

describe('PermissionSync', () => {
  let component: PermissionSync;
  let fixture: ComponentFixture<PermissionSync>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionSync]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionSync);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
