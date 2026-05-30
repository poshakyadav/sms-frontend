import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UdiseProfileEditor } from './udise-profile-editor';

describe('UdiseProfileEditor', () => {
  let component: UdiseProfileEditor;
  let fixture: ComponentFixture<UdiseProfileEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UdiseProfileEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UdiseProfileEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
