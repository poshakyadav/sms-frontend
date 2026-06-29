import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedReactionBar } from './feed-reaction-bar';

describe('FeedReactionBar', () => {
  let component: FeedReactionBar;
  let fixture: ComponentFixture<FeedReactionBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedReactionBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedReactionBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
