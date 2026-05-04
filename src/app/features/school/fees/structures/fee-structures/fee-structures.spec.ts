import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeStructures } from './fee-structures';

describe('FeeStructures', () => {
  let component: FeeStructures;
  let fixture: ComponentFixture<FeeStructures>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeStructures]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeStructures);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
