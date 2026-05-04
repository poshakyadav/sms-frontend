import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperLayout } from './super-layout';

describe('SuperLayout', () => {
  let component: SuperLayout;
  let fixture: ComponentFixture<SuperLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
