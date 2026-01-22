import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminLookup } from './admin-lookup';

describe('AdminLookup', () => {
  let component: AdminLookup;
  let fixture: ComponentFixture<AdminLookup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLookup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminLookup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
