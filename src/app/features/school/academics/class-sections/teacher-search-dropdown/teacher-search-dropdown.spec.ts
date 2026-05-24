import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherSearchDropdown } from './teacher-search-dropdown';

describe('TeacherSearchDropdown', () => {
  let component: TeacherSearchDropdown;
  let fixture: ComponentFixture<TeacherSearchDropdown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherSearchDropdown]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherSearchDropdown);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
