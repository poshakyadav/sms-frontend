import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessPlansManagement } from './access-plans-management';

describe('AccessPlansManagement', () => {
  let component: AccessPlansManagement;
  let fixture: ComponentFixture<AccessPlansManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessPlansManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessPlansManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
