import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperHeader } from './super-header';

describe('SuperHeader', () => {
  let component: SuperHeader;
  let fixture: ComponentFixture<SuperHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
