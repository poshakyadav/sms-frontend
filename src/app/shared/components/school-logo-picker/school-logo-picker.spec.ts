import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolLogoPicker } from './school-logo-picker';

describe('SchoolLogoPicker', () => {
  let component: SchoolLogoPicker;
  let fixture: ComponentFixture<SchoolLogoPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolLogoPicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolLogoPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
