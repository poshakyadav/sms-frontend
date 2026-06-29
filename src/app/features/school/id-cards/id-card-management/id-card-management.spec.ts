import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdCardManagement } from './id-card-management';

describe('IdCardManagement', () => {
  let component: IdCardManagement;
  let fixture: ComponentFixture<IdCardManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdCardManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdCardManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
