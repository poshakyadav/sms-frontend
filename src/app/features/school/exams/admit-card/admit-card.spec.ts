import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmitCard } from './admit-card';

describe('AdmitCard', () => {
  let component: AdmitCard;
  let fixture: ComponentFixture<AdmitCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdmitCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmitCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
