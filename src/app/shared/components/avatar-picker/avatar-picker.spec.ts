import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarPicker } from './avatar-picker';

describe('AvatarPicker', () => {
  let component: AvatarPicker;
  let fixture: ComponentFixture<AvatarPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarPicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvatarPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
