import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DueFeesPanel } from './due-fees-panel';

describe('DueFeesPanel', () => {
  let component: DueFeesPanel;
  let fixture: ComponentFixture<DueFeesPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DueFeesPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DueFeesPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
