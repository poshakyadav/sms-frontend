import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperSidebar } from './super-sidebar';

describe('SuperSidebar', () => {
  let component: SuperSidebar;
  let fixture: ComponentFixture<SuperSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperSidebar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperSidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
