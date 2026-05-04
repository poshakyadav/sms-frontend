import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParentAdmitCard } from './parent-admit-card';

describe('ParentAdmitCard', () => {
  let component: ParentAdmitCard;
  let fixture: ComponentFixture<ParentAdmitCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentAdmitCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParentAdmitCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
