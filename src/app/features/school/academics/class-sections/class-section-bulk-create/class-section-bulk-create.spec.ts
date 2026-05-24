import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassSectionBulkCreate } from './class-section-bulk-create';

describe('ClassSectionBulkCreate', () => {
  let component: ClassSectionBulkCreate;
  let fixture: ComponentFixture<ClassSectionBulkCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassSectionBulkCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassSectionBulkCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
