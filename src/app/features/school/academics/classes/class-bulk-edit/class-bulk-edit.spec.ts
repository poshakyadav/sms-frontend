import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassBulkEdit } from './class-bulk-edit';

describe('ClassBulkEdit', () => {
  let component: ClassBulkEdit;
  let fixture: ComponentFixture<ClassBulkEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassBulkEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassBulkEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
