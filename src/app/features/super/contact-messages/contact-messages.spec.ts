import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactMessages } from './contact-messages';

describe('ContactMessages', () => {
  let component: ContactMessages;
  let fixture: ComponentFixture<ContactMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactMessages]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactMessages);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
