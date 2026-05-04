import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TursoDbsComponent } from './turso-dbs-component';

describe('TursoDbsComponent', () => {
  let component: TursoDbsComponent;
  let fixture: ComponentFixture<TursoDbsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TursoDbsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TursoDbsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
