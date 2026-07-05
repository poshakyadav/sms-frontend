import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostImagePicker } from './post-image-picker';

describe('PostImagePicker', () => {
  let component: PostImagePicker;
  let fixture: ComponentFixture<PostImagePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostImagePicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PostImagePicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
