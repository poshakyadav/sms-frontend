import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdCardGenerateDialog } from './id-card-generate-dialog';

describe('IdCardGenerateDialog', () => {
  let component: IdCardGenerateDialog;
  let fixture: ComponentFixture<IdCardGenerateDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdCardGenerateDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdCardGenerateDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
