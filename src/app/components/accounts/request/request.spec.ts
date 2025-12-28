import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Request } from './request';

describe('Request', () => {
  let component: Request;
  let fixture: ComponentFixture<Request>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Request]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Request);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
