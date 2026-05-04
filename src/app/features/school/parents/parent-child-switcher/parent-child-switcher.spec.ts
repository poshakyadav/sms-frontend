import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentChildSwitcher } from './parent-child-switcher';

describe('ParentChildSwitcher', () => {
  let component: ParentChildSwitcher;
  let fixture: ComponentFixture<ParentChildSwitcher>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentChildSwitcher]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentChildSwitcher);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
