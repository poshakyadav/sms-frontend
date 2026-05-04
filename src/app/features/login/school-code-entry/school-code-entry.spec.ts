import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolCodeEntry } from './school-code-entry';

describe('SchoolCodeEntry', () => {
  let component: SchoolCodeEntry;
  let fixture: ComponentFixture<SchoolCodeEntry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolCodeEntry]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolCodeEntry);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
