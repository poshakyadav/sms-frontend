import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentHistorySearchAutocomplete } from './student-history-search-autocomplete';

describe('StudentHistorySearchAutocomplete', () => {
  let component: StudentHistorySearchAutocomplete;
  let fixture: ComponentFixture<StudentHistorySearchAutocomplete>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentHistorySearchAutocomplete]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentHistorySearchAutocomplete);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
