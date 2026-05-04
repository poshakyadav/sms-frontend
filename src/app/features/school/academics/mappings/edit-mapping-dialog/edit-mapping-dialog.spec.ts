import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditMappingDialog } from './edit-mapping-dialog';

describe('EditMappingDialog', () => {
  let component: EditMappingDialog;
  let fixture: ComponentFixture<EditMappingDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditMappingDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditMappingDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
