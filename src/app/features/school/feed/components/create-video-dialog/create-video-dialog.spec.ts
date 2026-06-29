import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateVideoDialog } from './create-video-dialog';

describe('CreateVideoDialog', () => {
  let component: CreateVideoDialog;
  let fixture: ComponentFixture<CreateVideoDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateVideoDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateVideoDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
