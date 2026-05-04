import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubjectsList } from './subjects-list';

describe('SubjectsList', () => {
  let component: SubjectsList;
  let fixture: ComponentFixture<SubjectsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubjectsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
