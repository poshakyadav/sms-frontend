import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConcessionsForm } from './concessions-form';

describe('ConcessionsForm', () => {
  let component: ConcessionsForm;
  let fixture: ComponentFixture<ConcessionsForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConcessionsForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConcessionsForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
