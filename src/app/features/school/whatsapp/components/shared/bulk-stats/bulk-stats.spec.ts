import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkStats } from './bulk-stats';

describe('BulkStats', () => {
  let component: BulkStats;
  let fixture: ComponentFixture<BulkStats>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkStats]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkStats);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
