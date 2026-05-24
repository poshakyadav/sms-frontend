import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeStatusBadge } from './fee-status-badge';

describe('FeeStatusBadge', () => {
  let component: FeeStatusBadge;
  let fixture: ComponentFixture<FeeStatusBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeStatusBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeStatusBadge);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
