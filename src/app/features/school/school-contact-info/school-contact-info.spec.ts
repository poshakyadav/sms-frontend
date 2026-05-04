import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolContactInfo } from './school-contact-info';

describe('SchoolContactInfo', () => {
  let component: SchoolContactInfo;
  let fixture: ComponentFixture<SchoolContactInfo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolContactInfo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolContactInfo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
