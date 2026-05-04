import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolSidebar } from './school-sidebar';

describe('SchoolSidebar', () => {
  let component: SchoolSidebar;
  let fixture: ComponentFixture<SchoolSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolSidebar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolSidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
