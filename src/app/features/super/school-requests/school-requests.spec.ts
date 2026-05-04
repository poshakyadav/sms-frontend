import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolRequests } from './school-requests';

describe('SchoolRequests', () => {
  let component: SchoolRequests;
  let fixture: ComponentFixture<SchoolRequests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolRequests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolRequests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
