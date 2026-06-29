import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkConfirm } from './bulk-confirm';

describe('BulkConfirm', () => {
  let component: BulkConfirm;
  let fixture: ComponentFixture<BulkConfirm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkConfirm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkConfirm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
