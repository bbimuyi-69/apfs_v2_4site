import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOffices } from './admin-offices';

describe('AdminOffices', () => {
  let component: AdminOffices;
  let fixture: ComponentFixture<AdminOffices>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOffices]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOffices);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
