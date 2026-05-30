import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UdiseCompletenessBadge } from './udise-completeness-badge';

describe('UdiseCompletenessBadge', () => {
  let component: UdiseCompletenessBadge;
  let fixture: ComponentFixture<UdiseCompletenessBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UdiseCompletenessBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UdiseCompletenessBadge);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
