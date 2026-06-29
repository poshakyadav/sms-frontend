import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappOverview } from './whatsapp-overview';

describe('WhatsappOverview', () => {
  let component: WhatsappOverview;
  let fixture: ComponentFixture<WhatsappOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhatsappOverview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
