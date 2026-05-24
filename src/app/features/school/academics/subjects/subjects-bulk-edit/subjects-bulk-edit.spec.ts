import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubjectsBulkEdit } from './subjects-bulk-edit';

describe('SubjectsBulkEdit', () => {
  let component: SubjectsBulkEdit;
  let fixture: ComponentFixture<SubjectsBulkEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectsBulkEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubjectsBulkEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
