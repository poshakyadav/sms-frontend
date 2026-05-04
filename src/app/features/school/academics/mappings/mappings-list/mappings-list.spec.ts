import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MappingsList } from './mappings-list';

describe('MappingsList', () => {
  let component: MappingsList;
  let fixture: ComponentFixture<MappingsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MappingsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
