import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RejectComment } from './reject-comment';

describe('RejectComment', () => {
  let component: RejectComment;
  let fixture: ComponentFixture<RejectComment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejectComment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RejectComment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
