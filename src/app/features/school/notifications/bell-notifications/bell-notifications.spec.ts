import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BellNotifications } from './bell-notifications';

describe('BellNotifications', () => {
  let component: BellNotifications;
  let fixture: ComponentFixture<BellNotifications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BellNotifications]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BellNotifications);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
