import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkStudentUpload } from './bulk-student-upload';

describe('BulkStudentUpload', () => {
  let component: BulkStudentUpload;
  let fixture: ComponentFixture<BulkStudentUpload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkStudentUpload]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkStudentUpload);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
