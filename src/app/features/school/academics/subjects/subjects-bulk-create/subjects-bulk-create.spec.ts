import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubjectsBulkCreate } from './subjects-bulk-create';

describe('SubjectsBulkCreate', () => {
  let component: SubjectsBulkCreate;
  let fixture: ComponentFixture<SubjectsBulkCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectsBulkCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubjectsBulkCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
