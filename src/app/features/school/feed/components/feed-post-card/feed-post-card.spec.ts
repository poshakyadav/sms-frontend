import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedPostCard } from './feed-post-card';

describe('FeedPostCard', () => {
  let component: FeedPostCard;
  let fixture: ComponentFixture<FeedPostCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedPostCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedPostCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
