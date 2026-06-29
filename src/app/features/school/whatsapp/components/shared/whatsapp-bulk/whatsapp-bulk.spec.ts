import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappBulk } from './whatsapp-bulk';

describe('WhatsappBulk', () => {
  let component: WhatsappBulk;
  let fixture: ComponentFixture<WhatsappBulk>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappBulk]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhatsappBulk);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
