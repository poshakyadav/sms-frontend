import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessExpiryBanner } from './access-expiry-banner';

describe('AccessExpiryBanner', () => {
  let component: AccessExpiryBanner;
  let fixture: ComponentFixture<AccessExpiryBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessExpiryBanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessExpiryBanner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
