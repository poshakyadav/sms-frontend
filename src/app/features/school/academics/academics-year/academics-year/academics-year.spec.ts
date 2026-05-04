import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcademicsYear } from './academics-year';

describe('AcademicsYear', () => {
  let component: AcademicsYear;
  let fixture: ComponentFixture<AcademicsYear>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcademicsYear]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcademicsYear);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
