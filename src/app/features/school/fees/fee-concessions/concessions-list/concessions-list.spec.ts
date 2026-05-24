import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConcessionsList } from './concessions-list';

describe('ConcessionsList', () => {
  let component: ConcessionsList;
  let fixture: ComponentFixture<ConcessionsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConcessionsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConcessionsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
