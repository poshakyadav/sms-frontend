import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SectionsList } from './sections-list';

describe('SectionsList', () => {
  let component: SectionsList;
  let fixture: ComponentFixture<SectionsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SectionsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
