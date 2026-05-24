import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeStructuresList } from './fee-structures-list';

describe('FeeStructuresList', () => {
  let component: FeeStructuresList;
  let fixture: ComponentFixture<FeeStructuresList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeStructuresList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeStructuresList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
