import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassSectionBulkEdit } from './class-section-bulk-edit';

describe('ClassSectionBulkEdit', () => {
  let component: ClassSectionBulkEdit;
  let fixture: ComponentFixture<ClassSectionBulkEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassSectionBulkEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassSectionBulkEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
