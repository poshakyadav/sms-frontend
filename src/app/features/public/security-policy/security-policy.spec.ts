import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityPolicy } from './security-policy';

describe('SecurityPolicy', () => {
  let component: SecurityPolicy;
  let fixture: ComponentFixture<SecurityPolicy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityPolicy]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecurityPolicy);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
