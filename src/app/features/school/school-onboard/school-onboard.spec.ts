import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolOnboard } from './school-onboard';

describe('SchoolOnboard', () => {
  let component: SchoolOnboard;
  let fixture: ComponentFixture<SchoolOnboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolOnboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolOnboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
