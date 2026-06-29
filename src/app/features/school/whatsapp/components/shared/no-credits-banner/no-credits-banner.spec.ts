import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoCreditsBanner } from './no-credits-banner';

describe('NoCreditsBanner', () => {
  let component: NoCreditsBanner;
  let fixture: ComponentFixture<NoCreditsBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoCreditsBanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoCreditsBanner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
