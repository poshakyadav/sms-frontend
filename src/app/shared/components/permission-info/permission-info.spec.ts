import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionInfo } from './permission-info';

describe('PermissionInfo', () => {
  let component: PermissionInfo;
  let fixture: ComponentFixture<PermissionInfo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionInfo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionInfo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
