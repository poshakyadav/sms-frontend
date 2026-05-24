import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassBulkCreate } from './class-bulk-create';

describe('ClassBulkCreate', () => {
  let component: ClassBulkCreate;
  let fixture: ComponentFixture<ClassBulkCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassBulkCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassBulkCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
