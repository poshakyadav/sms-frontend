import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UdiseExportDialog } from './udise-export-dialog';

describe('UdiseExportDialog', () => {
  let component: UdiseExportDialog;
  let fixture: ComponentFixture<UdiseExportDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UdiseExportDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UdiseExportDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
