import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AboutUsEditor } from './about-us-editor';

describe('AboutUsEditor', () => {
  let component: AboutUsEditor;
  let fixture: ComponentFixture<AboutUsEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutUsEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AboutUsEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
