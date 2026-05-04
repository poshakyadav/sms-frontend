import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolSettingsHub } from './school-settings-hub';

describe('SchoolSettingsHub', () => {
  let component: SchoolSettingsHub;
  let fixture: ComponentFixture<SchoolSettingsHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolSettingsHub]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolSettingsHub);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
