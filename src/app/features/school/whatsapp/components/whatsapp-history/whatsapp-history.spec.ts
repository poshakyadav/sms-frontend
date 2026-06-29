import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappHistory } from './whatsapp-history';

describe('WhatsappHistory', () => {
  let component: WhatsappHistory;
  let fixture: ComponentFixture<WhatsappHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappHistory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhatsappHistory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
