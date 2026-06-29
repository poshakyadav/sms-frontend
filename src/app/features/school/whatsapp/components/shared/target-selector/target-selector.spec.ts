import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TargetSelector } from './target-selector';

describe('TargetSelector', () => {
  let component: TargetSelector;
  let fixture: ComponentFixture<TargetSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TargetSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TargetSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
