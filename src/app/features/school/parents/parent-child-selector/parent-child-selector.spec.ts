import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentChildSelector } from './parent-child-selector';

describe('ParentChildSelector', () => {
  let component: ParentChildSelector;
  let fixture: ComponentFixture<ParentChildSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentChildSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentChildSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
