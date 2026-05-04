import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MappingsBulk } from './mappings-bulk';

describe('MappingsBulk', () => {
  let component: MappingsBulk;
  let fixture: ComponentFixture<MappingsBulk>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingsBulk]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MappingsBulk);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
