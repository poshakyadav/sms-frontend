import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappInbound } from './whatsapp-inbound';

describe('WhatsappInbound', () => {
  let component: WhatsappInbound;
  let fixture: ComponentFixture<WhatsappInbound>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappInbound]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhatsappInbound);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
