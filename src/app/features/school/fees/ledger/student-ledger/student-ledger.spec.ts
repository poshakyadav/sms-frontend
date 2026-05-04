import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentLedger } from './student-ledger';

describe('StudentLedger', () => {
  let component: StudentLedger;
  let fixture: ComponentFixture<StudentLedger>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentLedger]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentLedger);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
