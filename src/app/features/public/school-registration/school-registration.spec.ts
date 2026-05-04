import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolRegistration } from './school-registration';

describe('SchoolRegistration', () => {
  let component: SchoolRegistration;
  let fixture: ComponentFixture<SchoolRegistration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolRegistration]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolRegistration);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
