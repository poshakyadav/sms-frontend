import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappSend } from './whatsapp-send';

describe('WhatsappSend', () => {
  let component: WhatsappSend;
  let fixture: ComponentFixture<WhatsappSend>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappSend]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhatsappSend);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
