import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolInfo } from './school-info';

describe('SchoolInfo', () => {
  let component: SchoolInfo;
  let fixture: ComponentFixture<SchoolInfo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolInfo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolInfo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
