import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatePostDialog } from './create-post-dialog';

describe('CreatePostDialog', () => {
  let component: CreatePostDialog;
  let fixture: ComponentFixture<CreatePostDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePostDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePostDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
