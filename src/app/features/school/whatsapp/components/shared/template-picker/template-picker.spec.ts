import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplatePicker } from './template-picker';

describe('TemplatePicker', () => {
  let component: TemplatePicker;
  let fixture: ComponentFixture<TemplatePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatePicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplatePicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
