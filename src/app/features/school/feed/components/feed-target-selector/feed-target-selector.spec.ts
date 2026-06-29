import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedTargetSelector } from './feed-target-selector';

describe('FeedTargetSelector', () => {
  let component: FeedTargetSelector;
  let fixture: ComponentFixture<FeedTargetSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedTargetSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedTargetSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
