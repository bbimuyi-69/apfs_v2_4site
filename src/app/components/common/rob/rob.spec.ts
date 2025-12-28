import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rob } from './rob';

describe('Rob', () => {
  let component: Rob;
  let fixture: ComponentFixture<Rob>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rob]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Rob);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
