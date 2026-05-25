import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassSectionFeeManager } from './class-section-fee-manager';

describe('ClassSectionFeeManager', () => {
  let component: ClassSectionFeeManager;
  let fixture: ComponentFixture<ClassSectionFeeManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassSectionFeeManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassSectionFeeManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
