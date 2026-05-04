import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolLoginCredentials } from './school-login-credentials';

describe('SchoolLoginCredentials', () => {
  let component: SchoolLoginCredentials;
  let fixture: ComponentFixture<SchoolLoginCredentials>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolLoginCredentials]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolLoginCredentials);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
