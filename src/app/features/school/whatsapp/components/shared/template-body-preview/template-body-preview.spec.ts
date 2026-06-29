import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateBodyPreview } from './template-body-preview';

describe('TemplateBodyPreview', () => {
  let component: TemplateBodyPreview;
  let fixture: ComponentFixture<TemplateBodyPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateBodyPreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateBodyPreview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
