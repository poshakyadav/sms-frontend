import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperLogin } from './super-login';

describe('SuperLogin', () => {
  let component: SuperLogin;
  let fixture: ComponentFixture<SuperLogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperLogin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperLogin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
