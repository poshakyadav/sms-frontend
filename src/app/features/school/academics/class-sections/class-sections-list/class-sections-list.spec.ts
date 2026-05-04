import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassSectionsList } from './class-sections-list';

describe('ClassSectionsList', () => {
  let component: ClassSectionsList;
  let fixture: ComponentFixture<ClassSectionsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassSectionsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassSectionsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
