import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolLayout } from './school-layout';

describe('SchoolLayout', () => {
  let component: SchoolLayout;
  let fixture: ComponentFixture<SchoolLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
