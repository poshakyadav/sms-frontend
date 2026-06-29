import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkProgress } from './bulk-progress';

describe('BulkProgress', () => {
  let component: BulkProgress;
  let fixture: ComponentFixture<BulkProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkProgress]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkProgress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
