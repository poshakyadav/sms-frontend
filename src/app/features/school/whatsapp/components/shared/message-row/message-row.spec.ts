import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageRow } from './message-row';

describe('MessageRow', () => {
  let component: MessageRow;
  let fixture: ComponentFixture<MessageRow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageRow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessageRow);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
