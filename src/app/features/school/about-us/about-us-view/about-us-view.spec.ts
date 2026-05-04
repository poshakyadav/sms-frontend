import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AboutUsView } from './about-us-view';

describe('AboutUsView', () => {
  let component: AboutUsView;
  let fixture: ComponentFixture<AboutUsView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutUsView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AboutUsView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
