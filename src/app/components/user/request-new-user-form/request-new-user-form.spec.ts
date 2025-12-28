import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestNewUserForm } from './request-new-user-form';

describe('RquestNewUserForm', () => {
  let component: RequestNewUserForm;
  let fixture: ComponentFixture<RequestNewUserForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestNewUserForm]
    })
      .compileComponents();

    fixture = TestBed.createComponent(RequestNewUserForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
