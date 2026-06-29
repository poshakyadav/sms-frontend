import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedVideoCard } from './feed-video-card';

describe('FeedVideoCard', () => {
  let component: FeedVideoCard;
  let fixture: ComponentFixture<FeedVideoCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedVideoCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedVideoCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
