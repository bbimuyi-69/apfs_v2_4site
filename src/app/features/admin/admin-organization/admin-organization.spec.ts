import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOrganization } from './admin-organization';

describe('AdminOrganization', () => {
  let component: AdminOrganization;
  let fixture: ComponentFixture<AdminOrganization>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrganization]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOrganization);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
