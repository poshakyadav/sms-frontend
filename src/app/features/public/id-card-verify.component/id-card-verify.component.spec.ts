import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdCardVerifyComponent } from './id-card-verify.component';

describe('IdCardVerifyComponent', () => {
  let component: IdCardVerifyComponent;
  let fixture: ComponentFixture<IdCardVerifyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdCardVerifyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdCardVerifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
