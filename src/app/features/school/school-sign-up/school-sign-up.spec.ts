import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolSignUp } from './school-sign-up';

describe('SchoolSignUp', () => {
  let component: SchoolSignUp;
  let fixture: ComponentFixture<SchoolSignUp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolSignUp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolSignUp);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
