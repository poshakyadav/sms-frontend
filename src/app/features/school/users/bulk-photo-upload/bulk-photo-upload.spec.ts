import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkPhotoUpload } from './bulk-photo-upload';

describe('BulkPhotoUpload', () => {
  let component: BulkPhotoUpload;
  let fixture: ComponentFixture<BulkPhotoUpload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkPhotoUpload]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkPhotoUpload);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
