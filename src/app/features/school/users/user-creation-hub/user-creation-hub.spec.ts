import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCreationHub } from './user-creation-hub';

describe('UserCreationHub', () => {
  let component: UserCreationHub;
  let fixture: ComponentFixture<UserCreationHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCreationHub]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserCreationHub);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
