import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageBundles } from './message-bundles';

describe('MessageBundles', () => {
  let component: MessageBundles;
  let fixture: ComponentFixture<MessageBundles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageBundles]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessageBundles);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
