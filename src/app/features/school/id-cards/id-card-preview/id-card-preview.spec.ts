import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdCardPreview } from './id-card-preview';

describe('IdCardPreview', () => {
  let component: IdCardPreview;
  let fixture: ComponentFixture<IdCardPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdCardPreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdCardPreview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
