import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateManager } from './template-manager';

describe('TemplateManager', () => {
  let component: TemplateManager;
  let fixture: ComponentFixture<TemplateManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
