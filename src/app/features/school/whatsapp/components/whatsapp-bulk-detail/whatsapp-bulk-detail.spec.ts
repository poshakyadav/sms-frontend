import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappBulkDetail } from './whatsapp-bulk-detail';

describe('WhatsappBulkDetail', () => {
  let component: WhatsappBulkDetail;
  let fixture: ComponentFixture<WhatsappBulkDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappBulkDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhatsappBulkDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
