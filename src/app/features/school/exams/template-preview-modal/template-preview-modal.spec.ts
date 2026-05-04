import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplatePreviewModal } from './template-preview-modal';

describe('TemplatePreviewModal', () => {
  let component: TemplatePreviewModal;
  let fixture: ComponentFixture<TemplatePreviewModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatePreviewModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplatePreviewModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
