import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdCardTemplateManage } from './id-card-template-manage';

describe('IdCardTemplateManage', () => {
  let component: IdCardTemplateManage;
  let fixture: ComponentFixture<IdCardTemplateManage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdCardTemplateManage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdCardTemplateManage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
