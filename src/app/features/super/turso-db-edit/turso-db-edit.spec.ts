import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TursoDbEdit } from './turso-db-edit';

describe('TursoDbEdit', () => {
  let component: TursoDbEdit;
  let fixture: ComponentFixture<TursoDbEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TursoDbEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TursoDbEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
