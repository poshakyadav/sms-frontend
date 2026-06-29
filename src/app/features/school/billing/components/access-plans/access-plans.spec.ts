import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessPlans } from './access-plans';

describe('AccessPlans', () => {
  let component: AccessPlans;
  let fixture: ComponentFixture<AccessPlans>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessPlans]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessPlans);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
