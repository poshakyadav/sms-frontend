import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentParentsManager } from './student-parents-manager';

describe('StudentParentsManager', () => {
  let component: StudentParentsManager;
  let fixture: ComponentFixture<StudentParentsManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentParentsManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentParentsManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
