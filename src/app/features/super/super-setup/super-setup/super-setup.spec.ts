import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperSetup } from './super-setup';

describe('SuperSetup', () => {
  let component: SuperSetup;
  let fixture: ComponentFixture<SuperSetup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperSetup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperSetup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
