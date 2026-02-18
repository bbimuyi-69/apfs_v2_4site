import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOfficeForm } from './admin-office-form';

describe('AdminOfficeForm', () => {
  let component: AdminOfficeForm;
  let fixture: ComponentFixture<AdminOfficeForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOfficeForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOfficeForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
