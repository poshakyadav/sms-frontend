import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolHeader } from './school-header';

describe('SchoolHeader', () => {
  let component: SchoolHeader;
  let fixture: ComponentFixture<SchoolHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
