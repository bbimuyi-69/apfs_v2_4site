import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOrganizationForm } from './admin-organization-form';

describe('AdminOrganizationForm', () => {
  let component: AdminOrganizationForm;
  let fixture: ComponentFixture<AdminOrganizationForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrganizationForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOrganizationForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
