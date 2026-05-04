import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FieldHelpDialog } from './field-help-dialog';

describe('FieldHelpDialog', () => {
  let component: FieldHelpDialog;
  let fixture: ComponentFixture<FieldHelpDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldHelpDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FieldHelpDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
